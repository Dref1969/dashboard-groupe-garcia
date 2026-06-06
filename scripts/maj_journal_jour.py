"""
MAJ Journal des ventes MIX JOUR — découverte + (à venir) Top 3 meilleures ventes
Source : 3GWIN "TOUTES JOURNAL DES VENTES MIX JOUR" (lien token, sans login).

Phase 1 (actuelle) = DÉCOUVERTE :
  - Navigue le lien 3GWIN (WinDev, SSL expiré → ignore_https_errors)
  - Attend le rendu, dump tout (innerText, tables, HTML, screenshot)
  → permet d'identifier les colonnes du journal quand il y a des ventes.

Phase 2 (après découverte) :
  - Parser chaque ligne de vente (vendeur, boutique, produit, CA, marge…)
  - Top 3 des meilleures ventes du jour + détail
  - POST vers Apps Script → onglet Journal_Jour → Dashboard Jour
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

JOURNAL_URL = ("http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin"
               "?3G=183b18f2ccc8c404436921c92d9e664263e8bee98e787b33d8de0edc0dc5a6dc669883ebefbb136e0d18334fe496")


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    log("=== JOURNAL VENTES MIX JOUR — découverte ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--ignore-certificate-errors"])
        ctx = browser.new_context(viewport={"width": 1600, "height": 1000}, ignore_https_errors=True)
        page = ctx.new_page()
        page.set_default_timeout(45000)
        try:
            log(f"Navigate vers le journal 3GWIN")
            page.goto(JOURNAL_URL, wait_until="domcontentloaded")
            # WinDev charge la grille en AJAX — laisser le temps
            time.sleep(10)
            log(f"  URL: {page.url}")
            page.screenshot(path="01_journal.png", full_page=True)
            with open("01_journal.html", "w", encoding="utf-8") as f:
                f.write(page.content()[:400000])

            # Inventaire : toutes les tables avec >=2 cellules non vides par ligne
            tables = page.evaluate("""
                () => {
                    const out = [];
                    document.querySelectorAll('table').forEach((t, i) => {
                        const rows = [];
                        t.querySelectorAll('tr').forEach(tr => {
                            const cells = Array.from(tr.querySelectorAll('td,th'))
                                .map(c => (c.innerText||'').trim());
                            const nonEmpty = cells.filter(x => x);
                            // ignore les tables de layout (mêmes valeurs répétées)
                            const uniq = new Set(nonEmpty);
                            if (nonEmpty.length >= 2 && uniq.size >= 2) rows.push(cells);
                        });
                        if (rows.length) out.push({table: i, rows: rows.slice(0, 25)});
                    });
                    return out;
                }
            """)
            log(f"Tables 'données' candidates : {len(tables)}")
            for t in tables:
                log(f"  --- Table {t['table']} ({len(t['rows'])} lignes) ---")
                for r in t["rows"][:25]:
                    log(f"    {r}")

            # Texte brut du body
            body = page.evaluate("() => document.body.innerText")
            log(f"Body innerText ({len(body)} chars) :")
            for line in body.split("\n"):
                if line.strip():
                    log(f"  | {line.strip()}")

            log("=== DÉCOUVERTE TERMINÉE — analyser artifacts si vide, relancer en journée ===")
        finally:
            browser.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FATAL: {e}")
        sys.exit(1)
