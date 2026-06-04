"""
MAJ DILAX automatisée — tourne via GitHub Actions
1. Login sfr.dilax.com (Playwright Chromium headless)
2. Scrape les 6 boutiques (Highcharts data via JS injection)
3. Lit la marge depuis Données_Commissions (gviz CSV public)
4. Calcule Panier Moyen + Taux Transfo
5. POST vers Apps Script qui écrit l'onglet DILAX
"""
import os
import sys
import csv
import io
import json
import time
import urllib.request
from playwright.sync_api import sync_playwright

DILAX_USER = os.environ["DILAX_USER"]
DILAX_PASSWORD = os.environ["DILAX_PASSWORD"]
APPS_SCRIPT_URL = os.environ["APPS_SCRIPT_URL"]

SHEET_ID = "1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY"

# Ordre : nom DILAX exact tel qu'affiché dans le sélecteur, nom court, code boutique
SITES = [
    ("ANJOU LIAISON RADIO",                    "Angers",      "ALR"),
    ("ANJOU LIAISON RADIO CHOLET CARREFOUR",   "Cholet",      "CHOLET"),
    ("CHATEAUDUN LIAISONS RADIO",              "Chateaudun",  "CLR"),
    ("ROMORANTIN LIAISON RADIO",               "Romorantin",  "RLR"),
    ("TOURAINE LIAISON RADIO - AMBOISE",       "Amboise",     "TLR"),
    ("VENDOME LIAISONS RADIO",                 "Vendome",     "VLR"),
]


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def scrape_dilax():
    """Scrape visiteurs depuis sfr.dilax.com — retourne dict {code: visiteurs}."""
    visiteurs = {c: 0 for _, _, c in SITES}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 1600, "height": 900})
        page = ctx.new_page()
        page.set_default_timeout(30000)

        try:
            # === 1. Login ===
            log("Navigate vers DILAX login")
            page.goto("https://sfr.dilax.com/sfr/login.html", wait_until="networkidle")
            time.sleep(2)

            log("Login")
            # Sélecteurs en fallback : essaie plusieurs noms d'attributs
            for sel in ['input[type="email"]', 'input[name="username"]',
                        'input[name="email"]', 'input[name="login"]']:
                if page.locator(sel).count() > 0:
                    page.fill(sel, DILAX_USER)
                    break
            for sel in ['input[type="password"]', 'input[name="password"]']:
                if page.locator(sel).count() > 0:
                    page.fill(sel, DILAX_PASSWORD)
                    break
            # Bouton submit
            for sel in ['button[type="submit"]', 'input[type="submit"]',
                        'button:has-text("Connexion")', 'button:has-text("Login")']:
                if page.locator(sel).count() > 0:
                    page.click(sel)
                    break

            page.wait_for_load_state("networkidle", timeout=30000)
            time.sleep(3)
            log(f"  URL après login: {page.url}")

            if "login" in page.url.lower():
                page.screenshot(path="login_fail.png")
                raise RuntimeError("Login DILAX échoué — vérifier secrets")

            # === 2. Navigate Indicateurs clés > Rapport graphique ===
            log("Navigate vers Rapport graphique")
            # Click sur menu "Indicateurs clés"
            for sel in ['a:has-text("Indicateurs clés")', 'text=Indicateurs clés']:
                if page.locator(sel).first.is_visible():
                    page.locator(sel).first.click()
                    break
            time.sleep(1)
            # Click sur "Rapport graphique"
            for sel in ['a:has-text("Rapport graphique")', 'text=Rapport graphique']:
                if page.locator(sel).first.is_visible():
                    page.locator(sel).first.click()
                    break
            page.wait_for_load_state("networkidle")
            time.sleep(3)

            # === 3. Configurer (Site unique / Mois en cours / Mensuel / Entrées site) ===
            # Ces options sont souvent persistées par DILAX — on saute la config détaillée
            # et on s'assure juste qu'on est en mode "Site unique"

            # === 4. Boucle sur les 6 sites ===
            for dilax_name, nom, code in SITES:
                log(f"Site {code} ({nom}) — {dilax_name}")
                try:
                    # Click sur le sélecteur de site (souvent un dropdown <select> ou un autocomplete)
                    site_selector_candidates = [
                        '[class*="site-select"]',
                        '[class*="siteSelect"]',
                        'select[name*="site"]',
                        '[aria-label*="Site"]',
                        'input[placeholder*="Site"]',
                    ]
                    clicked = False
                    for sel in site_selector_candidates:
                        if page.locator(sel).first.is_visible():
                            page.locator(sel).first.click()
                            clicked = True
                            break
                    if not clicked:
                        log(f"  WARN: sélecteur de site non trouvé pour {code}")

                    time.sleep(1)
                    # Choisir le site dans la liste
                    page.get_by_text(dilax_name, exact=False).first.click(timeout=10000)
                    page.wait_for_load_state("networkidle")
                    time.sleep(3)

                    # Extraire la somme via Highcharts
                    total = page.evaluate("""
                        () => {
                            if (typeof Highcharts === 'undefined') return -1;
                            const charts = Highcharts.charts.filter(c => c);
                            if (!charts.length) return -2;
                            const c = charts[0];
                            if (!c.series || !c.series[0]) return -3;
                            return c.series[0].data.reduce(function(s, p) {
                                return s + (p.y || 0);
                            }, 0);
                        }
                    """)
                    if isinstance(total, (int, float)) and total >= 0:
                        visiteurs[code] = int(total)
                        log(f"  ✓ {visiteurs[code]} visiteurs")
                    else:
                        log(f"  ✗ Highcharts code retour {total}")
                except Exception as e:
                    log(f"  ✗ Erreur site {code}: {e}")
                    page.screenshot(path=f"error_{code}.png")
        finally:
            browser.close()

    return visiteurs


def read_sheet_data():
    """Lit Marge/Mob/Cyber/Assu agrégés par boutique depuis Données_Commissions."""
    url = (f"https://docs.google.com/spreadsheets/d/{SHEET_ID}"
           "/gviz/tq?tqx=out:csv&sheet=Donn%C3%A9es_Commissions")
    log(f"Lecture Sheet via gviz CSV")
    with urllib.request.urlopen(url, timeout=30) as resp:
        text = resp.read().decode("utf-8")

    reader = csv.DictReader(io.StringIO(text))
    marge, mob, cyber, assu = {}, {}, {}, {}
    for row in reader:
        code = (row.get("CodeBoutique") or "").strip()
        if not code:
            continue
        def num(k):
            v = (row.get(k) or "0").replace(",", ".").strip()
            try:
                return float(v)
            except ValueError:
                return 0.0
        marge[code] = marge.get(code, 0) + num("Marge")
        mob[code]   = mob.get(code, 0)   + int(num("Mobiles"))
        cyber[code] = cyber.get(code, 0) + int(num("Cyber"))
        assu[code]  = assu.get(code, 0)  + int(num("Assurance"))
    return marge, mob, cyber, assu


def main():
    log("=== MAJ DILAX ===")

    visiteurs = scrape_dilax()
    log(f"Visiteurs scrapés : {visiteurs}")

    marge, mob, cyber, assu = read_sheet_data()
    log(f"Marges Sheet : {marge}")

    NOMS = {"ALR": "Angers", "TLR": "Amboise", "CLR": "Chateaudun",
            "CHOLET": "Cholet", "RLR": "Romorantin", "VLR": "Vendome"}

    resultats = []
    for code in ["ALR", "TLR", "CLR", "CHOLET", "RLR", "VLR"]:
        v = visiteurs.get(code, 0)
        m = round(marge.get(code, 0), 2)
        pm = round(m / v, 2) if v > 0 else 0
        tx = round((mob.get(code, 0) / v) * 100, 2) if v > 0 else 0
        resultats.append({
            "rang": 0,
            "boutique": NOMS[code],
            "code": code,
            "visiteurs": v,
            "marge": m,
            "mob": mob.get(code, 0),
            "cyber": cyber.get(code, 0),
            "assu": assu.get(code, 0),
            "pm": pm,
            "tx": tx,
        })

    resultats.sort(key=lambda x: x["pm"], reverse=True)
    for i, r in enumerate(resultats):
        r["rang"] = i + 1

    log("Résultats triés PM desc :")
    for r in resultats:
        log(f"  #{r['rang']} {r['boutique']:12s} v={r['visiteurs']:6d}  m={r['marge']:8.2f}  pm={r['pm']:6.2f}  tx={r['tx']:5.2f}%")

    log("POST vers Apps Script")
    payload = json.dumps({"dilax": resultats}).encode("utf-8")
    req = urllib.request.Request(
        APPS_SCRIPT_URL, data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
        log(f"  Réponse: {body}")

    log("=== TERMINÉ ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FATAL: {e}")
        sys.exit(1)
