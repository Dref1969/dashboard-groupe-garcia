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
import re
import sys
import time
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


def tester(url):
    """Retourne (statut, taille_octets, detail). Reessaie sur reponse anormale."""
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
                return ("OK", taille, "essai %d" % essai)
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
    for _token, url, usages in liens:
        statut, taille, detail = tester(url)
        lib = libelle_usages(usages)
        print("  %-9s %8.1f Ko  %s  (%s)" % (statut, taille / 1024.0, lib, detail))
        if statut != "OK":
            morts.append((usages, statut, detail, url))

    print("")
    if not morts:
        print("OK : les %d liens 3GWIN repondent normalement." % len(liens))
        return 0

    print("=" * 70)
    print("ALERTE : %d lien(s) 3GWIN hors service sur %d" % (len(morts), len(liens)))
    print("=" * 70)
    for usages, statut, detail, url in morts:
        print("\n  Lien %s : %s" % (statut, detail))
        print("  %s" % url)
        print("  Casse %d usage(s) :" % len(usages))
        for pipeline, nom in usages:
            print("    - %s  ->  %s" % (pipeline, nom))
    print("""
Comment reparer : ouvrir 3GWIN, menu VENDEUR ITEM AGENDA > Publication Web/Mail,
selectionner la ligne concernee, bouton "Forcer Publication", puis copier le
champ "Lien internet" et le redeployer partout ou il est utilise (repo GitHub
ET Apps Script en ligne). Si la ligne a disparu de la liste, la publication a
ete supprimee : la recreer avec le bouton "+" (periode, tableau predefini,
agences), ou basculer l'usage sur un lien equivalent encore vivant.""")
    return 1


if __name__ == "__main__":
    sys.exit(main())
