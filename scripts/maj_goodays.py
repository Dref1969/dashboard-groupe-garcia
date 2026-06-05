"""
MAJ Goodays/Critizr automatisée — tourne via GitHub Actions
1. Login critizr.com (Playwright Chromium headless)
2. Synthèse → Note Top Sat /5 + participations par boutique (30 derniers jours)
3. Questionnaires > Google My Business → avis Google par boutique (mois en cours)
4. POST vers Apps Script qui écrit l'onglet GOODAYS

NOTE: Première itération = découverte du DOM Critizr. Le script dump
beaucoup de HTML/screenshots pour permettre d'ajuster les sélecteurs.
"""
import os
import sys
import json
import time
import urllib.request
from playwright.sync_api import sync_playwright

GOODAYS_USER = os.environ["GOODAYS_USER"]
GOODAYS_PASSWORD = os.environ["GOODAYS_PASSWORD"]
APPS_SCRIPT_URL = os.environ["APPS_SCRIPT_URL"]

# Boutiques : mot-clé pour matcher le nom Goodays, nom court, code
# (les noms Goodays sont sans accents : "Vendome", "Chateaudun")
SHOPS = [
    ("besnardi",   "Angers",     "ALR"),     # SFR Angers Besnardière
    ("amboise",    "Amboise",    "TLR"),     # SFR Amboise
    ("chateaudun", "Chateaudun", "CLR"),     # SFR Chateaudun
    ("cholet",     "Cholet",     "CHOLET"),  # SFR Cholet
    ("romorantin", "Romorantin", "RLR"),     # SFR Romorantin
    ("vendome",    "Vendome",    "VLR"),     # SFR Vendome
]


def match_code(nom):
    """Retourne le code boutique depuis un nom Goodays, ou None."""
    n = nom.lower()
    for kw, _, code in SHOPS:
        if kw in n:
            return code
    return None

OBJECTIF = 4.50


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def dump(page, name):
    """Sauve screenshot + HTML pour debug."""
    try:
        page.screenshot(path=f"{name}.png")
        with open(f"{name}.html", "w", encoding="utf-8") as f:
            f.write(page.content()[:300000])
        log(f"  dump {name} sauvé")
    except Exception as e:
        log(f"  dump {name} échoué: {e}")


def scrape_goodays():
    """Retourne dict {code: {note, participations, avis_google}}."""
    data = {c: {"note": 0, "part": 0, "avis": 0} for _, _, c in SHOPS}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 1600, "height": 900})
        page = ctx.new_page()
        page.set_default_timeout(30000)

        try:
            # === 1. Login Goodays (app Django, 2 étapes : email → Suivant → password) ===
            log("Navigate vers Goodays login")
            page.goto("https://app.goodays.co/pro/login/", wait_until="domcontentloaded")
            time.sleep(4)
            dump(page, "01_login_email")
            log(f"  URL: {page.url}")

            # Étape 1 : email + bouton "Suivant"
            log("Étape 1 : email")
            page.fill('#id_email', GOODAYS_USER)
            time.sleep(1)
            page.click('button[type="submit"]')  # "Suivant"
            page.wait_for_load_state("networkidle", timeout=20000)
            time.sleep(3)
            dump(page, "02_login_password")
            log(f"  URL après Suivant: {page.url}")

            # Étape 2 : password (le champ apparaît après le 1er submit)
            log("Étape 2 : password")
            pwd_ok = False
            for sel in ['#id_password', 'input[type="password"]',
                        'input[name="password"]']:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=5000):
                        loc.fill(GOODAYS_PASSWORD)
                        log(f"  password rempli via {sel}")
                        pwd_ok = True
                        break
                except Exception:
                    continue
            if not pwd_ok:
                dump(page, "02b_pwd_introuvable")
                raise RuntimeError("Champ password introuvable à l'étape 2")

            time.sleep(1)
            page.click('button[type="submit"]')  # "Se connecter"
            page.wait_for_load_state("networkidle", timeout=30000)
            time.sleep(5)
            dump(page, "03_after_login")
            log(f"  URL après login: {page.url}")

            if "/login" in page.url.lower():
                raise RuntimeError("Login Goodays échoué — vérifier secrets (toujours sur /login)")

            # === 2. Page Synthèse (/pro/overview) — Note Top Sat (30 derniers jours) ===
            # SPA : navigation directe + domcontentloaded (networkidle ne se déclenche jamais)
            # Période "30 derniers jours" est le défaut Goodays → pas besoin de configurer.
            log("Navigate vers Synthèse (/pro/overview)")
            page.goto("https://app.goodays.co/pro/overview",
                      wait_until="domcontentloaded")
            time.sleep(8)  # laisser la SPA charger les données
            dump(page, "05_synthese")

            # Extraire le bloc "Satisfaction client" : table avec header "Note satis."
            # Chaque ligne : [rang, boutique, note, participations]
            sat = page.evaluate("""
                () => {
                    const tables = Array.from(document.querySelectorAll('table'));
                    for (const t of tables) {
                        if (!/Note satis/i.test(t.innerText)) continue;
                        const rows = [];
                        t.querySelectorAll('tbody tr, tr').forEach(tr => {
                            const cells = Array.from(tr.querySelectorAll('td'))
                                .map(td => td.innerText.trim()).filter(x => x);
                            if (cells.length >= 3) {
                                // chercher le nom (contient "SFR"), la note (X,XX) et la part (entier)
                                const nom = cells.find(c => /SFR/i.test(c)) || cells[1] || '';
                                const nums = cells.filter(c => /^[0-9]/.test(c));
                                rows.push({nom: nom, vals: nums});
                            }
                        });
                        return rows;
                    }
                    return [];
                }
            """)
            log(f"  Lignes satisfaction extraites : {len(sat)}")
            for r in sat:
                nom = r["nom"]
                code = None
                # match côté Python
                code = next((c for kw, _, c in SHOPS if kw in nom.lower()), None)
                if not code:
                    log(f"    ? non matché : '{nom}' vals={r['vals']}")
                    continue
                # vals = [note, participations] (la note a une virgule)
                note = 0.0
                part = 0
                for v in r["vals"]:
                    vc = v.replace(",", ".")
                    if "." in vc:  # c'est la note
                        try:
                            note = float(vc)
                        except ValueError:
                            pass
                    else:  # entier = participations
                        try:
                            part = int(v)
                        except ValueError:
                            pass
                data[code]["note"] = note
                data[code]["part"] = part
                log(f"    {code} '{nom}' note={note} part={part}")

            log("Phase 2 OK — notes extraites. Découverte GMB (avis Google).")

            # === 3. Questionnaires > Google My Business (/pro/surveys) ===
            log("Navigate vers Questionnaires (/pro/surveys)")
            page.goto("https://app.goodays.co/pro/surveys",
                      wait_until="domcontentloaded")
            time.sleep(8)
            dump(page, "06_surveys")
            # Lister les questionnaires + liens pour trouver "Google My Business"
            survey_links = page.evaluate("""
                () => {
                    const out = [];
                    document.querySelectorAll('a[href], button, li, div[class*="survey"]').forEach(el => {
                        const t = (el.innerText || '').trim();
                        if (t && t.length < 60 && /google|my business|gmb|questionnaire/i.test(t)) {
                            out.push({tag: el.tagName, text: t, href: el.getAttribute('href') || ''});
                        }
                    });
                    return out.slice(0, 30);
                }
            """)
            log(f"  Éléments GMB/questionnaire trouvés : {len(survey_links)}")
            for s in survey_links:
                log(f"    [{s['tag']}] '{s['text']}' -> {s['href']}")

            log("Phase 3 découverte GMB terminée — analyser dump 06_surveys")

        finally:
            browser.close()

    return data


def main():
    log("=== MAJ GOODAYS ===")
    data = scrape_goodays()
    log(f"Données scrapées : {json.dumps(data, ensure_ascii=False)}")

    # Construire les résultats triés par note décroissante
    NOMS = {"ALR": "Angers", "TLR": "Amboise", "CLR": "Chateaudun",
            "CHOLET": "Cholet", "RLR": "Romorantin", "VLR": "Vendome"}

    resultats = []
    for code in ["ALR", "TLR", "CLR", "CHOLET", "RLR", "VLR"]:
        d = data.get(code, {})
        note = d.get("note", 0)
        if note >= 4.70:
            statut = "✅ Très bien"
        elif note >= 4.50:
            statut = "🟠 Correct"
        else:
            statut = "🔴 À améliorer"
        ecart = round(note - OBJECTIF, 2)
        resultats.append({
            "rang": 0,
            "boutique": NOMS[code],
            "code": code,
            "note": note,
            "statut": statut,
            "ecart": ecart,
            "avis": d.get("avis", 0),
            "part": d.get("part", 0),
        })

    resultats.sort(key=lambda x: x["note"], reverse=True)
    for i, r in enumerate(resultats):
        r["rang"] = i + 1

    log("Résultats triés Note desc :")
    for r in resultats:
        log(f"  #{r['rang']} {r['boutique']:12s} note={r['note']:.2f}  {r['statut']}  avis={r['avis']}  part={r['part']}")

    # POST vers Apps Script (seulement si on a des données non nulles)
    has_data = any(r["note"] > 0 for r in resultats)
    if not has_data:
        log("⚠ Aucune note scrapée — phase de découverte, pas de POST")
        return

    log("POST vers Apps Script")
    payload = json.dumps({"type": "goodays", "goodays": resultats}).encode("utf-8")
    req = urllib.request.Request(
        APPS_SCRIPT_URL, data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            log(f"  Réponse: {resp.read().decode('utf-8')}")
    except Exception as e:
        log(f"  ✗ POST échoué : {e}")

    log("=== TERMINÉ ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FATAL: {e}")
        sys.exit(1)
