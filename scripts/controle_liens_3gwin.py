# -*- coding: utf-8 -*-
"""
Controle quotidien de la sante des liens de publication 3GWIN.

Pourquoi : ces liens (publications "Web/Mail" de 3GWIN, authentifies par un token
dans l'URL) meurent silencieusement quand la publication est supprimee ou
regeneree cote 3GWIN. C'est arrive le 10-11/07/2026 : la publication JOUR du
JOURNAL DES VENTES MIX a disparu, et la panne n'a ete vue qu'au bout de 4 jours
(via un email d'echec toutes les 5 min). Depuis, les scripts sortent proprement
quand un lien est mort -> plus aucun signal. D'ou ce controle dedie.

Un lien mort renvoie une page ~6-7 Ko "Pas de tableau a afficher".
Un lien vivant renvoie plusieurs dizaines de Ko a plusieurs Mo de tableau.

Les liens ne sont PAS recopies ici : ils sont extraits des fichiers sources, pour
que le controle ne puisse pas diverger de ce que le systeme utilise reellement.

Sortie : exit 1 uniquement si un lien est REELLEMENT mort (apres reessais), afin
que GitHub n'envoie un email que dans ce cas. Le serveur 3GWIN a des rates
transitoires (constate le 07/09/2026 sur VENDOME mois : vide au 1er appel, OK au
2e) -> sans reessai, on genererait de fausses alertes.
"""
import datetime
import re
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# Fichiers sources scannes -> etiquette du pipeline concerne
SOURCES = {
    "scripts/maj_journal_jour.py": "Meilleure vente du jour",
    "BACKOFFICE/Apps_Script_3GWIN/MAJ_3GWIN_Autonome.gs": "Pipeline MENSUEL",
    "BACKOFFICE/Apps_Script_3GWIN/MAJ_Dashboard_Jour.gs": "Pipeline JOUR",
}

URL_RE = re.compile(r"https?://3cx\.3gwin\.net/[^\s'\"()]+")

# Etiquette lisible : nom de variable (var URL_MAGS_JOUR = ...) ou code boutique
# (code:'ALR'), sinon la fin du token.
VAR_RE = re.compile(r"(?:var|const)\s+([A-Z_0-9]+)\s*=")
CODE_RE = re.compile(r"code\s*:\s*'([^']+)'")
PY_VAR_RE = re.compile(r"^([A-Z_0-9]+)\s*=")

# Recolle une URL coupee sur plusieurs lignes (concatenation Python)
RECOLLE_RE = re.compile(r'"\s*\n\s*"')

TIMEOUT = 60
ESSAIS = 3
PAUSE = 5  # secondes entre deux essais


def etiquette(ligne, token):
    for regex in (VAR_RE, CODE_RE, PY_VAR_RE):
        m = regex.search(ligne)
        if m:
            return m.group(1)
    return "token " + token[-12:]


def collecter():
    """Liste les liens 3GWIN regroupes par TOKEN.

    Le regroupement se fait sur le token et non sur l'URL entiere : le meme
    token est reference a plusieurs endroits (parfois en http, parfois en
    https). S'il meurt, plusieurs pipelines tombent ensemble -- l'alerte doit
    donc citer TOUS les usages, pas seulement le premier rencontre.
    """
    par_token = {}
    ordre = []
    for rel, pipeline in SOURCES.items():
        chemin = RACINE / rel
        if not chemin.exists():
            print("ATTENTION : fichier source introuvable, ignore : %s" % rel)
            continue
        contenu = RECOLLE_RE.sub("", chemin.read_text(encoding="utf-8", errors="replace"))
        for ligne in contenu.splitlines():
            if "3gwin.net" not in ligne:
                continue
            for url in URL_RE.findall(ligne):
                if "?3G=" not in url:
                    continue  # liens de session CTX_, non testables
                token = url.split("?3G=")[1]
                usage = (pipeline, etiquette(ligne, token))
                if token not in par_token:
                    par_token[token] = {"url": url, "usages": []}
                    ordre.append(token)
                if usage not in par_token[token]["usages"]:
                    par_token[token]["usages"].append(usage)
    return [(t, par_token[t]["url"], par_token[t]["usages"]) for t in ordre]


# ---------------------------------------------------------------------------
# Detection des pages FIGEES (ajout du 10/09/2026)
#
# Un lien peut repondre normalement tout en servant une page perimee : la
# publication 3GWIN n'a pas ete rejouee et le tableau reste fige sur une
# journee passee. C'est arrive 3 fois sur "TOUTES JOURNAL DES VENTES MIX MOIS"
# (11/07, 07/09, 09/09/2026) : le controle passait au vert alors que la
# meilleure vente du jour et le TOP 10 mobiles du Manager etaient morts depuis
# 2 jours. Le test "lien mort" ne voit rien -- d'ou ce second controle.
#
# Chaque page 3GWIN porte en tete "<AGENCE> JJ/MM HH:MM". On compare cette date
# au dernier jour ou l'agence EMETTRICE etait ouverte, d'ou les regles ci-dessous.
# ---------------------------------------------------------------------------

# En-tete : "<libelle agence> JJ/MM HH:MM" juste avant "Gestion commerciale".
# Le libelle peut contenir # et _ (siege = "#DIR_CO"), d'ou \S plutot que \w.
ENTETE_RE = re.compile(r"(\S{2,20})\s+(\d{2})/(\d{2})\s+(\d{2}):(\d{2})\s+Gestion commerciale")
ENTETE_REPLI_RE = re.compile(r"(\d{2})/(\d{2})\s+(\d{2}):(\d{2})")

# Heure a partir de laquelle on exige une publication DU JOUR. Les boutiques
# ouvrent vers 10h ; le cron tourne a 8h -> avant 11h on se contente de la
# derniere journee d'ouverture ecoulee.
HEURE_EXIGENCE_JOUR = 11

# Agences fermees le lundi (depuis le 06/07/2026 seuls CHOLET et ANGERS ouvrent).
# Un jour ferie, seul CHOLET ouvre. Le dimanche et le 1er mai, tout est ferme.
# "#DIR_CO" = le poste du siege : il publie tous les jours sauf le dimanche.
OUVRE_LUNDI = {"CHOLET", "ANGERS", "#DIR_CO"}
OUVRE_FERIE = {"CHOLET", "#DIR_CO"}


def normaliser_agence(libelle):
    """'Chateaudun' / 'CHATEAUDUN' / '#DIR_CO' -> forme majuscule sans accent."""
    sans_accent = unicodedata.normalize("NFKD", libelle)
    sans_accent = "".join(c for c in sans_accent if not unicodedata.combining(c))
    return sans_accent.upper().strip()


def feries(annee):
    """Jours feries francais de l'annee (Paques calculee, algorithme de Butcher)."""
    a = annee % 19
    b, c = divmod(annee, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mois, jour = divmod(h + l - 7 * m + 114, 31)
    paques = datetime.date(annee, mois, jour + 1)
    return {
        datetime.date(annee, 1, 1), datetime.date(annee, 5, 1),
        datetime.date(annee, 5, 8), datetime.date(annee, 7, 14),
        datetime.date(annee, 8, 15), datetime.date(annee, 11, 1),
        datetime.date(annee, 11, 11), datetime.date(annee, 12, 25),
        paques + datetime.timedelta(days=1),    # lundi de Paques
        paques + datetime.timedelta(days=39),   # Ascension
        paques + datetime.timedelta(days=50),   # lundi de Pentecote
    }


def est_ouvert(agence, jour):
    """L'agence emettrice publiait-elle ce jour-la ?"""
    if jour.weekday() == 6:                       # dimanche
        return False
    if jour == datetime.date(jour.year, 5, 1):    # 1er mai : tout ferme
        return False
    if jour in feries(jour.year):
        return agence in OUVRE_FERIE
    if jour.weekday() == 0:                       # lundi
        return agence in OUVRE_LUNDI
    return True


def date_attendue(agence, maintenant):
    """Date que l'en-tete devrait porter au plus tard, pour cette agence."""
    jour = maintenant.date()
    if not (est_ouvert(agence, jour) and maintenant.hour >= HEURE_EXIGENCE_JOUR):
        jour -= datetime.timedelta(days=1)
    for _ in range(15):                           # marge large (ponts, feries)
        if est_ouvert(agence, jour):
            return jour
        jour -= datetime.timedelta(days=1)
    return jour


def lire_entete(html, maintenant):
    """Retourne (libelle_agence, date_entete) ou (None, None) si introuvable.

    L'en-tete ne porte que JJ/MM : l'annee est deduite en prenant celle qui
    place la date dans le passe proche (evite de dater 31/12 de l'annee en
    cours quand on controle le 1er janvier).
    """
    texte = re.sub(r"<[^>]+>", " ", html)
    m = ENTETE_RE.search(texte)
    if m:
        libelle, jour, mois = m.group(1), int(m.group(2)), int(m.group(3))
    else:
        m = ENTETE_REPLI_RE.search(texte)
        if not m:
            return None, None
        libelle, jour, mois = "?", int(m.group(1)), int(m.group(2))
    for annee in (maintenant.year, maintenant.year - 1):
        try:
            d = datetime.date(annee, mois, jour)
        except ValueError:
            continue
        if d <= maintenant.date():
            return libelle, d
    return libelle, None


def tester(url):
    """Retourne (statut, taille_octets, detail). Reessaie sur reponse anormale.

    Statuts : OK / FIGE (page servie mais perimee) / MORT / VIDE / INJOIGNABLE.
    """
    maintenant = datetime.datetime.now()
    dernier = ("INJOIGNABLE", 0, "aucun essai")
    for essai in range(1, ESSAIS + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            html = urllib.request.urlopen(req, timeout=TIMEOUT).read().decode("utf-8", "replace")
        except Exception as e:
            dernier = ("INJOIGNABLE", 0, "%s: %s" % (type(e).__name__, e))
        else:
            taille = len(html)
            if "Pas de tableau" in html:
                dernier = ("MORT", taille, "page 'Pas de tableau a afficher'")
            elif re.search(r"Vendeur|VENDEUR|Marge|MARGE|AGENCE|Date raccord", html):
                libelle, date_page = lire_entete(html, maintenant)
                if date_page is None:
                    # En-tete illisible : on ne bloque pas sur un changement de
                    # gabarit 3GWIN, le lien lui-meme repond.
                    return ("OK", taille, "essai %d, en-tete illisible" % essai)
                attendue = date_attendue(normaliser_agence(libelle), maintenant)
                if date_page < attendue:
                    retard = (attendue - date_page).days
                    return ("FIGE", taille,
                            "en-tete %s %s, attendu %s (%d j de retard)"
                            % (libelle, date_page.strftime("%d/%m"),
                               attendue.strftime("%d/%m"), retard))
                return ("OK", taille, "essai %d, en-tete %s %s"
                        % (essai, libelle, date_page.strftime("%d/%m")))
            else:
                dernier = ("VIDE", taille, "aucun contenu de tableau reconnu")
        if essai < ESSAIS:
            time.sleep(PAUSE)
    return dernier


def libelle_usages(usages):
    return " + ".join("%s/%s" % (p, n) for p, n in usages)


def main():
    liens = collecter()
    if not liens:
        print("ERREUR : aucun lien 3GWIN trouve dans les fichiers sources.")
        return 1

    nb_usages = sum(len(u) for _, _, u in liens)
    print("Controle de %d liens 3GWIN distincts (%d usages dans le code)\n"
          % (len(liens), nb_usages))

    morts = []
    figes = []
    for _token, url, usages in liens:
        statut, taille, detail = tester(url)
        lib = libelle_usages(usages)
        print("  %-9s %8.1f Ko  %s  (%s)" % (statut, taille / 1024.0, lib, detail))
        if statut == "FIGE":
            figes.append((usages, statut, detail, url))
        elif statut != "OK":
            morts.append((usages, statut, detail, url))

    print("")
    if not morts and not figes:
        print("OK : les %d liens 3GWIN repondent et sont a jour." % len(liens))
        return 0

    def detailler(lot, titre):
        print("=" * 70)
        print(titre)
        print("=" * 70)
        for usages, statut, detail, url in lot:
            print("\n  Lien %s : %s" % (statut, detail))
            print("  %s" % url)
            print("  Casse %d usage(s) :" % len(usages))
            for pipeline, nom in usages:
                print("    - %s  ->  %s" % (pipeline, nom))

    if morts:
        detailler(morts, "ALERTE : %d lien(s) 3GWIN hors service sur %d"
                  % (len(morts), len(liens)))
        print("""
Comment reparer : ouvrir 3GWIN, menu VENDEUR ITEM AGENDA > Publication Web/Mail,
selectionner la ligne concernee, bouton "Forcer Publication", puis copier le
champ "Lien internet" et le redeployer partout ou il est utilise (repo GitHub
ET Apps Script en ligne). Si la ligne a disparu de la liste, la publication a
ete supprimee : la recreer avec le bouton "+" (periode, tableau predefini,
agences), ou basculer l'usage sur un lien equivalent encore vivant.""")

    if figes:
        detailler(figes, "ALERTE : %d publication(s) 3GWIN FIGEE(S) sur %d"
                  % (len(figes), len(liens)))
        print("""
Le lien repond, mais la page servie date d'un jour d'ouverture passe : les
pipelines ingerent donc des chiffres perimes SANS aucune erreur visible.

Comment reparer : ouvrir 3GWIN, menu VENDEUR ITEM AGENDA > Publication Web/Mail,
onglet PARAMETRES, selectionner la ligne concernee, bouton "Forcer Publication",
attendre "Tableau publie" en bas a gauche. Verifier ensuite que l'en-tete de la
page porte bien la date du jour. Si le token a change au passage, le redeployer
(repo GitHub ET Apps Script en ligne).

Si la page est emise par une agence fermee ce jour-la, c'est normal : basculer
l'agence emettrice de la publication sur CHOLET (ouvert le plus souvent).""")

    return 1


if __name__ == "__main__":
    sys.exit(main())
