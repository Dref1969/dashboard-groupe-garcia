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
que GitHub n'envoie un email que dans ce cas. Le serveur 3GWIN a des ratés
transitoires (constate le 07/09/2026 sur VENDOME mois : vide au 1er appel, OK au
2e) -> sans reessai, on genererait de fausses alertes.
"""
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# Fichiers sources scannes -> etiquette du pipeline concerne
SOURCES = {
    "scripts/maj_journal_jour.py": "Meilleure vente du jour",
    "BACKOFFICE/Apps_Script_3GWIN/MAJ_3GWIN_Autonome.gs": "Pipeline MENSUEL (dashboard manager)",
    "BACKOFFICE/Apps_Script_3GWIN/MAJ_Dashboard_Jour.gs": "Pipeline JOUR (dashboard jour)",
}

URL_RE = re.compile(r"https?://3cx\.3gwin\.net/[^\s'\"()]+")

# Etiquette lisible : nom de variable (var URL_MAGS_JOUR = ...) ou code boutique
# (code:'ALR', nom:'Angers'), sinon le token tronque.
VAR_RE = re.compile(r"(?:var|const)\s+([A-Z_0-9]+)\s*=")
CODE_RE = re.compile(r"code\s*:\s*'([^']+)'")
PY_VAR_RE = re.compile(r"^([A-Z_0-9]+)\s*=")

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
    """Extrait {(fichier, etiquette, url)} de tous les fichiers sources."""
    liens = []
    vus = set()
    for rel, pipeline in SOURCES.items():
        chemin = RACINE / rel
        if not chemin.exists():
            print("ATTENTION : fichier source introuvable, ignore : %s" % rel)
            continue
        contenu = chemin.read_text(encoding="utf-8", errors="replace")
        # Les URL peuvent etre coupees sur plusieurs lignes (concatenation Python)
        contenu_plat = re.sub(r"\"\s*\n\s*\"", "", contenu)
        for ligne in contenu_plat.splitlines():
            if "3gwin.net" not in ligne:
                continue
            for url in URL_RE.findall(ligne):
                if "?3G=" not in url:
                    continue  # liens de session CTX_, non testables
                token = url.split("?3G=")[1]
                if url in vus:
                    continue
                vus.add(url)
                liens.append((pipeline, etiquette(ligne, token), url))
    return liens


def tester(url):
    """Retourne (statut, taille_octets, detail). Reessaie sur reponse vide."""
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


def main():
    liens = collecter()
    if not liens:
        print("ERREUR : aucun lien 3GWIN trouve dans les fichiers sources.")
        return 1

    print("Controle de %d liens de publication 3GWIN\n" % len(liens))
    morts = []
    pipeline_courant = None
    for pipeline, nom, url in liens:
        if pipeline != pipeline_courant:
            pipeline_courant = pipeline
            print("--- %s" % pipeline)
        statut, taille, detail = tester(url)
        print("  %-9s %-28s %8.1f Ko  (%s)" % (statut, nom, taille / 1024.0, detail))
        if statut != "OK":
            morts.append((pipeline, nom, statut, detail, url))

    print("")
    if not morts:
        print("OK : les %d liens 3GWIN repondent normalement." % len(liens))
        return 0

    print("=" * 70)
    print("ALERTE : %d lien(s) 3GWIN hors service sur %d" % (len(morts), len(liens)))
    print("=" * 70)
    for pipeline, nom, statut, detail, url in morts:
        print("\n  [%s] %s  ->  %s" % (pipeline, nom, statut))
        print("  %s" % detail)
        print("  %s" % url)
    print("""
Comment reparer : ouvrir 3GWIN, menu VENDEUR ITEM AGENDA > Publication Web/Mail,
selectionner la ligne concernee, bouton "Forcer Publication", puis copier le
champ "Lien internet" et le redeployer (repo GitHub + Apps Script en ligne).
Si la ligne a disparu de la liste, la publication a ete supprimee : la recreer
avec le bouton "+" (periode, tableau predefini, agences).""")
    return 1


if __name__ == "__main__":
    sys.exit(main())
