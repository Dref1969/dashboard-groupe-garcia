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
            # URL avec hash routing Angular
            page.goto("https://sfr.dilax.com/sfr/login.html#/dashboard",
                      wait_until="domcontentloaded")
            time.sleep(5)
            page.screenshot(path="01_after_load.png")
            log(f"  URL chargée: {page.url}")

            log("Attente form login visible (id=username)")
            # Le vrai form login utilise name='username' (PAS email — celui-ci est
            # dans la modal Forgot Password cachée)
            try:
                page.wait_for_selector('#username', timeout=20000, state="visible")
            except Exception as e:
                log(f"  Form login pas visible : {e}")
                page.screenshot(path="02_input_not_visible.png")
                html = page.content()
                with open("page_dump.html", "w", encoding="utf-8") as f:
                    f.write(html[:50000])
                raise

            log("Login - remplir username")
            page.fill('#username', DILAX_USER)
            time.sleep(1)
            log("Login - remplir password")
            page.fill('#password', DILAX_PASSWORD)
            time.sleep(1)
            page.screenshot(path="03_filled.png")

            log("Click login button")
            page.click('#loginButton')

            # Attendre que le form login disparaisse (vraie détection d'auth réussie)
            try:
                page.wait_for_selector('#username', state="hidden", timeout=20000)
                log("  Form login disparu — auth OK")
            except Exception as e:
                page.screenshot(path="login_fail.png")
                # Vérifier si message d'erreur visible
                err_visible = page.locator('.alert-danger:visible').count() > 0
                if err_visible:
                    raise RuntimeError("Login DILAX refusé (Incorrect credentials)")
                log(f"  WARN form toujours visible : {e} (peut-être lent à charger)")

            # Attendre que le dashboard soit chargé (networkidle + menu visible)
            try:
                page.wait_for_load_state("networkidle", timeout=20000)
            except Exception:
                pass
            time.sleep(5)
            page.screenshot(path="04_after_login.png")
            log(f"  URL après login: {page.url}")

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

            # === 3. Dump HTML page Rapport graphique pour analyse dropdown ===
            page.screenshot(path="05_rapport_graphique.png")
            with open("rapport_graphique.html", "w", encoding="utf-8") as f:
                f.write(page.content()[:200000])
            log("Dump HTML page Rapport graphique sauvé")

            # Inventaire des éléments de sélection candidats
            inventaire = page.evaluate("""
                () => {
                    const result = {
                        selects: [],
                        uiSelects: [],
                        select2: [],
                        ngModels: [],
                        sidebar: []
                    };
                    document.querySelectorAll('select').forEach(s => {
                        result.selects.push({
                            name: s.name, id: s.id, ngModel: s.getAttribute('ng-model'),
                            visible: s.offsetParent !== null,
                            opts: Array.from(s.options).slice(0,3).map(o => o.text)
                        });
                    });
                    document.querySelectorAll('.ui-select-container, [class*="ui-select"]').forEach(s => {
                        result.uiSelects.push({
                            class: s.className,
                            visible: s.offsetParent !== null,
                            text: s.innerText.substring(0, 80)
                        });
                    });
                    document.querySelectorAll('.select2-container, [class*="select2"]').forEach(s => {
                        result.select2.push({class: s.className, visible: s.offsetParent !== null});
                    });
                    document.querySelectorAll('[ng-model*="site" i], [ng-model*="Site"]').forEach(s => {
                        result.ngModels.push({tag: s.tagName, ngModel: s.getAttribute('ng-model'), visible: s.offsetParent !== null});
                    });
                    // Cherche éléments cliquables contenant un nom de site DILAX
                    const candidates = document.querySelectorAll('a, li, div[ng-click], button');
                    let count = 0;
                    candidates.forEach(el => {
                        const t = (el.innerText || '').trim();
                        if (t.includes('ANJOU') || t.includes('VENDOME') || t.includes('CHATEAUDUN')) {
                            if (count < 10 && el.offsetParent !== null) {
                                result.sidebar.push({
                                    tag: el.tagName,
                                    text: t.substring(0, 80),
                                    ngClick: el.getAttribute('ng-click'),
                                    class: el.className.substring(0, 60)
                                });
                                count++;
                            }
                        }
                    });
                    return result;
                }
            """)
            log(f"Inventaire dropdowns: selects={len(inventaire['selects'])}, "
                f"uiSelects={len(inventaire['uiSelects'])}, "
                f"select2={len(inventaire['select2'])}, "
                f"ngModels site={len(inventaire['ngModels'])}, "
                f"clickables sites={len(inventaire['sidebar'])}")
            for k, v in inventaire.items():
                if v:
                    log(f"  {k}: {json.dumps(v, ensure_ascii=False)[:500]}")

            # === 4. Boucle sur les 6 sites ===
            for dilax_name, nom, code in SITES:
                log(f"Site {code} ({nom}) — {dilax_name}")
                try:
                    clicked = False
                    # Stratégie 1: <select> natif
                    select_native = page.locator('select').filter(has_text=dilax_name)
                    if select_native.count() > 0 and select_native.first.is_visible():
                        select_native.first.select_option(label=dilax_name)
                        clicked = True
                        log(f"  selected via <select> native")
                    # Stratégie 2: clickable direct contenant le nom du site
                    if not clicked:
                        for sel in [
                            f'a:has-text("{dilax_name}")',
                            f'li:has-text("{dilax_name}")',
                            f'div[ng-click]:has-text("{dilax_name}")',
                        ]:
                            loc = page.locator(sel).first
                            try:
                                if loc.is_visible(timeout=2000):
                                    loc.click(timeout=5000)
                                    clicked = True
                                    log(f"  clicked via {sel}")
                                    break
                            except Exception:
                                continue
                    if not clicked:
                        log(f"  ✗ aucun sélecteur trouvé pour {code}")
                        continue

                    page.wait_for_load_state("networkidle", timeout=15000)
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
    payload = json.dumps({"type": "dilax", "dilax": resultats}).encode("utf-8")
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
