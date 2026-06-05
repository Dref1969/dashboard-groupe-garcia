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

# Boutiques : nom Critizr exact, nom court, code
SHOPS = [
    ("SFR Angers Besnardière", "Angers",     "ALR"),
    ("SFR Amboise",            "Amboise",     "TLR"),
    ("SFR Châteaudun",         "Chateaudun",  "CLR"),
    ("SFR Cholet",             "Cholet",      "CHOLET"),
    ("SFR Romorantin",         "Romorantin",  "RLR"),
    ("SFR Vendôme",            "Vendome",     "VLR"),
]

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
            # === 1. Login ===
            log("Navigate vers Critizr login")
            page.goto("https://critizr.com/", wait_until="domcontentloaded")
            time.sleep(4)
            dump(page, "01_landing")
            log(f"  URL: {page.url}")

            # Chercher un lien/bouton "Connexion" / "Login" / "Se connecter"
            for sel in ['a:has-text("Connexion")', 'a:has-text("Se connecter")',
                        'a:has-text("Login")', 'a[href*="login"]',
                        'a[href*="signin"]', 'button:has-text("Connexion")']:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=2000):
                        loc.click(timeout=3000)
                        log(f"  cliqué lien connexion via {sel}")
                        time.sleep(3)
                        break
                except Exception:
                    continue

            dump(page, "02_login_page")
            log(f"  URL après clic connexion: {page.url}")

            # Remplir email + mot de passe (sélecteurs en fallback)
            email_ok = False
            for sel in ['input[type="email"]', 'input[name="email"]',
                        'input[name="username"]', 'input[id*="email" i]',
                        'input[placeholder*="mail" i]']:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=2000):
                        loc.fill(GOODAYS_USER)
                        log(f"  email rempli via {sel}")
                        email_ok = True
                        break
                except Exception:
                    continue

            pwd_ok = False
            for sel in ['input[type="password"]', 'input[name="password"]',
                        'input[id*="password" i]']:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=2000):
                        loc.fill(GOODAYS_PASSWORD)
                        log(f"  password rempli via {sel}")
                        pwd_ok = True
                        break
                except Exception:
                    continue

            if not (email_ok and pwd_ok):
                dump(page, "02b_form_introuvable")
                raise RuntimeError(f"Form login introuvable (email={email_ok}, pwd={pwd_ok})")

            time.sleep(1)
            # Soumettre
            for sel in ['button[type="submit"]', 'input[type="submit"]',
                        'button:has-text("Connexion")', 'button:has-text("Se connecter")',
                        'button:has-text("Login")']:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=2000):
                        loc.click(timeout=3000)
                        log(f"  submit via {sel}")
                        break
                except Exception:
                    continue

            page.wait_for_load_state("networkidle", timeout=30000)
            time.sleep(5)
            dump(page, "03_after_login")
            log(f"  URL après login: {page.url}")

            if "login" in page.url.lower() or "signin" in page.url.lower():
                # Vérifier message d'erreur
                raise RuntimeError("Login Critizr échoué — vérifier secrets (URL contient login)")

            # === 2. Page Synthèse — Note Top Sat (30 derniers jours) ===
            log("Navigate vers Synthèse")
            # Le point d'entrée connu charge le dashboard
            page.goto("https://critizr.com/pro/messages/active/12854986",
                      wait_until="domcontentloaded")
            time.sleep(5)
            dump(page, "04_dashboard")

            # Cliquer sur "Synthèse" dans le menu latéral
            for sel in ['a:has-text("Synthèse")', 'text=Synthèse',
                        '[href*="synthes" i]', '[href*="summary" i]']:
                try:
                    loc = page.locator(sel).first
                    if loc.is_visible(timeout=3000):
                        loc.click(timeout=3000)
                        log(f"  cliqué Synthèse via {sel}")
                        break
                except Exception:
                    continue
            time.sleep(5)
            dump(page, "05_synthese")
            log("  Page Synthèse chargée — voir dump pour structure")

            # === 3. Questionnaires > GMB — avis Google (mois en cours) ===
            # (à implémenter après découverte du DOM Synthèse)
            log("Découverte phase 1 terminée — analyser les dumps")

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
