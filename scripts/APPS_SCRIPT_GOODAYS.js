/**
 * PATCH À APPLIQUER DANS L'APPS SCRIPT du Sheet Principal
 * (même projet que handleDilaxData)
 *
 * 1. Dans doPost (Code.gs), ajouter une branche :
 *
 *      if (data.type === 'goodays') {
 *        return handleGoodaysData(data);
 *      }
 *
 * 2. Coller la fonction handleGoodaysData ci-dessous dans DILAX_Update.gs
 *    (ou un nouveau fichier Goodays_Update.gs).
 */

function handleGoodaysData(data) {
  try {
    var ss = SpreadsheetApp.openById('1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY');
    var sheet = ss.getSheetByName('GOODAYS');
    if (!sheet) sheet = ss.insertSheet('GOODAYS');

    var goodays = data.goodays || [];
    if (goodays.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({status:'error', message:'Empty goodays payload'})).setMimeType(ContentService.MimeType.JSON);
    }

    // Effacer rows 2 à 9 (6 boutiques + moyenne + date)
    sheet.getRange('A2:G9').clearContent();

    // Lignes 2-7 : les 6 boutiques triées Note desc
    // Colonnes : Rang | Boutique | Note /5 | Statut | Écart/Obj | Avis Google | Participations
    var rows = goodays.map(function(r) {
      var ecartStr = (r.ecart >= 0 ? '+' : '') + r.ecart.toFixed(2).replace('.', ',');
      return [r.rang, r.boutique, r.note, r.statut, ecartStr, r.avis, r.part];
    });
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 7).setValues(rows);
    }

    // Ligne 8 : MOYENNE GROUPE
    var totNote = 0, totAvis = 0, totPart = 0, n = 0;
    goodays.forEach(function(r) {
      if (r.note > 0) { totNote += r.note; n++; }
      totAvis += (r.avis || 0);
      totPart += (r.part || 0);
    });
    var moyNote = n > 0 ? Math.round(totNote / n * 100) / 100 : 0;
    sheet.getRange(8, 1, 1, 7).setValues([['', 'MOYENNE GROUPE', moyNote, '', '', totAvis, totPart]]);

    // Ligne 9 : date dernière MAJ
    var dateStr = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');
    sheet.getRange('B9').setValue(dateStr);

    return ContentService.createTextOutput(JSON.stringify({status:'ok', rows: rows.length})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status:'error', message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
