/**
 * PATCH À APPLIQUER DANS L'APPS SCRIPT du Sheet Principal
 * (éditeur ouvert via Extensions > Apps Script)
 *
 * 1. Ouvrir le fichier qui contient la fonction `doPost` (probablement `MAJ_Auto.gs`
 *    ou `Code.gs` selon ton projet).
 *
 * 2. Dans le `doPost`, ajouter une branche qui détecte le champ `dilax` du payload :
 *
 *      function doPost(e) {
 *        try {
 *          const data = JSON.parse(e.postData.contents);
 *
 *          // ... code existant (vendeurs, mags) ...
 *
 *          // === NOUVEAU : payload DILAX depuis GitHub Actions ===
 *          if (data.dilax && Array.isArray(data.dilax)) {
 *            ecrireDilax(data.dilax);
 *          }
 *
 *          return ContentService.createTextOutput(JSON.stringify({status: "ok"}))
 *            .setMimeType(ContentService.MimeType.JSON);
 *        } catch (err) {
 *          return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.message}))
 *            .setMimeType(ContentService.MimeType.JSON);
 *        }
 *      }
 *
 * 3. Coller la fonction `ecrireDilax` ci-dessous dans le même fichier .gs :
 */

function ecrireDilax(dilax) {
  const SHEET_ID_DILAX = "1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY";
  const ss = SpreadsheetApp.openById(SHEET_ID_DILAX);
  let ws = ss.getSheetByName("DILAX");
  if (!ws) ws = ss.insertSheet("DILAX");

  // En-tête (au cas où ce serait vide)
  ws.getRange("A1:J1").setValues([[
    "Rang", "Boutique", "Code", "Visiteurs", "Marge",
    "Mob", "Cyber", "Assurance", "Panier Moyen", "Taux Transfo"
  ]]);

  // Effacer anciennes lignes (2 à 9)
  const lastRow = ws.getLastRow();
  if (lastRow > 1) ws.getRange(2, 1, Math.max(lastRow - 1, 8), 10).clearContent();

  // Lignes 2-7 : les 6 boutiques triées PM desc
  const rows = dilax.map(r => [
    r.rang, r.boutique, r.code, r.visiteurs, r.marge,
    r.mob, r.cyber, r.assu, r.pm, r.tx
  ]);
  if (rows.length > 0) {
    ws.getRange(2, 1, rows.length, 10).setValues(rows);
  }

  // Ligne 8 : TOTAL GROUPE
  const totV   = dilax.reduce((s, r) => s + (r.visiteurs || 0), 0);
  const totM   = dilax.reduce((s, r) => s + (r.marge     || 0), 0);
  const totMob = dilax.reduce((s, r) => s + (r.mob       || 0), 0);
  const totCy  = dilax.reduce((s, r) => s + (r.cyber     || 0), 0);
  const totAs  = dilax.reduce((s, r) => s + (r.assu      || 0), 0);
  const pmG = totV > 0 ? Math.round(totM / totV * 100) / 100 : 0;
  const txG = totV > 0 ? Math.round(totMob / totV * 10000) / 100 : 0;
  ws.getRange(8, 1, 1, 10).setValues([[
    "", "TOTAL GROUPE", "", totV, Math.round(totM * 100) / 100,
    totMob, totCy, totAs, pmG, txG
  ]]);

  // Ligne 9 : date dernière MAJ
  const dateStr = Utilities.formatDate(new Date(), "Europe/Paris", "dd/MM/yyyy HH:mm");
  ws.getRange("B9").setValue(dateStr);
}
