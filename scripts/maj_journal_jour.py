# -*- coding: utf-8 -*-
"""
MAJ Journal des ventes MIX JOUR — Phase 2 : MEILLEURE VENTE DU JOUR.
Source : 3GWIN "TOUTES JOURNAL DES VENTES MIX JOUR" (lien token, sans login).
Le token dans l'URL authentifie un simple GET HTTP — pas besoin de navigateur/Playwright.
Sortie : meilleure_vente.json à la racine du repo (lu par le pop-up du Dashboard Jour).
La meilleure VENTE = la FACTURE du jour qui totalise le plus de marge (sans nom client).
Si le token expire un jour, mettre à jour JOURNAL_URL ci-dessous.
"""
import os, re, json, datetime, urllib.request
from html.parser import HTMLParser

# 14/07/2026 : la publication JOUR a ete SUPPRIMEE de 3GWIN (menage du 10-11/07).
# On scrape la publication MOIS (TOUTES JOURNAL DES VENTES MIX MOIS, ~8-20 Mo,
# donnees vivantes) : le filtre "date == aujourd'hui" ci-dessous isole le jour.
# Meme token que URL_FACTURES_MOIS de MAJ_3GWIN_Autonome.gs — si l'un meurt,
# l'autre aussi (regeneration : VENDEUR ITEM AGENDA > Publication Web/Mail).
JOURNAL_URL = ("https://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin"
               "?3G=183b18f2ccc8c404436921c92d9e664263e8bee98e787b33d8de0edc0dc5a6dcc615af6c5c9870ff7ce06c6748ab")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "meilleure_vente.json")

class TableParser(HTMLParser):
    # Piles table/tr/td : la page d'erreur 3GWIN ("Pas de tableau à afficher")
    # contient des tables imbriquées dans des cellules — un parseur à état plat
    # plantait en AttributeError et faisait échouer le workflow toutes les 5 min.
    def __init__(self):
        super().__init__(); self.tables=[]; self.stack=[]; self.rows=[]; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=="table":
            cur=[]; self.tables.append(cur); self.stack.append(cur); self.rows.append(None); self.cell=None
        elif tag=="tr" and self.stack:
            row=[]; self.stack[-1].append(row); self.rows[-1]=row; self.cell=None
        elif tag in ("td","th") and self.rows and self.rows[-1] is not None: self.cell=[]
    def handle_endtag(self, tag):
        if tag in ("td","th"):
            if self.cell is not None and self.rows and self.rows[-1] is not None:
                self.rows[-1].append(re.sub(r"\s+"," ","".join(self.cell)).strip())
            self.cell=None
        elif tag=="tr":
            if self.rows: self.rows[-1]=None
            self.cell=None
        elif tag=="table":
            if self.stack: self.stack.pop(); self.rows.pop()
            self.cell=None
    def handle_data(self, d):
        if self.cell is not None: self.cell.append(d)

def numf(x):
    x=re.sub(r"[^0-9,\-\.]","",str(x)).replace(",",".")
    try: return float(x)
    except: return 0.0

def main():
    html = urllib.request.urlopen(urllib.request.Request(JOURNAL_URL, headers={"User-Agent":"Mozilla/5.0"}), timeout=40).read().decode("utf-8","replace")
    if "Pas de tableau" in html:
        # Token/publication 3GWIN mort : sortie PROPRE (exit 0) pour ne pas
        # spammer un email d'échec toutes les 5 min. Régénérer le lien dans
        # 3GWIN : VENDEUR ITEM AGENDA > Publication Web/Mail > ligne
        # "TOUTES JOURNAL DES VENTES MIX JOUR" > Forcer Publication.
        print("ATTENTION : page 3GWIN sans tableau (token/publication expiré ?) — meilleure_vente.json inchangé.")
        return
    p=TableParser(); p.feed(html)
    if not p.tables:
        print("ATTENTION : aucun tableau dans la page 3GWIN — meilleure_vente.json inchangé.")
        return
    grid=max(p.tables, key=len)
    hdr=next((r for r in grid[:6] if "Vendeur" in r and "Marge" in r), grid[0])
    ci={c.strip():i for i,c in enumerate(hdr)}
    iDate,iAg,iV,iFac,iD,iFam,iActe,iM = (ci.get("Date"),ci.get("Ag."),ci.get("Vendeur"),
        ci.get("N° Fac."),ci.get("Désignation"),ci.get("FAMILLE"),ci.get("Type Acte"),ci.get("Marge"))
    today=datetime.date.today().strftime("%Y%m%d")
    fac={}
    # TOUS les vendeurs participent à la meilleure vente du jour — y compris
    # ROMAIN GP (CDV) : contrairement au challenge vendeur du Dashboard, AUCUNE
    # exclusion ici. Ne pas ajouter de filtre par nom.
    for r in grid:
        if iM is None or len(r)<=iM: continue
        v=(r[iV] if iV is not None else "").strip()
        if not v or v=="Vendeur": continue
        if iDate is not None and r[iDate].strip()!=today: continue
        f=(r[iFac] if iFac is not None else "").strip()
        if not f: continue
        o=fac.setdefault(f, {"fac":f,"vendeur":v,"agence":(r[iAg].strip() if iAg is not None else ""),"articles":[],"total":0.0})
        label=(r[iD].strip() if iD is not None else "") or (r[iActe].strip() if iActe is not None else "") or (r[iFam].strip() if iFam is not None else "") or "Article"
        m=numf(r[iM]); o["articles"].append({"desig":label, "marge":round(m,2)}); o["total"]+=m
    top=sorted(fac.values(), key=lambda x:-x["total"])
    for o in top: o["total"]=round(o["total"],2)
    best = top[0] if top else None
    data={
      "maj": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
      "date": today,
      "nb_factures": len(fac),
      "meilleure_vente": best,
      "top": [{"vendeur":o["vendeur"],"agence":o["agence"],"total":o["total"],"nb":len(o["articles"])} for o in top[:5]],
    }
    json.dump(data, open(OUT,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
    print("OK meilleure_vente.json :", (best["vendeur"]+" "+str(best["total"])+" EUR ("+str(len(fac))+" factures)") if best else "aucune vente du jour")

if __name__=="__main__":
    main()
