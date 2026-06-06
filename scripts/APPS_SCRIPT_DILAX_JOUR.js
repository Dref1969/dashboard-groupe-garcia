/**
 * PATCH APPS SCRIPT — handleDilaxJourData (onglet DILAX_Jour)
 *
 * 1. Dans doPost (Code.gs), ajouter avant la branche dilax :
 *      if (data.type === 'dilax_jour') { return handleDilaxJourData(data); }
 *
 * 2. Coller la fonction ci-dessous dans DILAX_Update.gs.
 *
 * L'onglet DILAX_Jour stocke les visiteurs DILAX du JOUR par boutique.
 * Le Dashboard Jour le lit et calcule le panier moyen = marge jour / visiteurs jour.
 */

function handleDilaxJourData(data) {
  try {
    var ss = SpreadsheetApp.openById('1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY');
    var sheet = ss.getSheetByName('DILAX_Jour');
    if (!sheet) sheet = ss.insertSheet('DILAX_Jour');

    var rows = data.dilax_jour || [];
    // En-tête lu par le Dashboard Jour
    sheet.getRange('A1:B1').setValues([['Code', 'Visiteurs']]);
    sheet.getRange('A2:B10').clearContent();

    var out = rows.map(function(r) { return [r.code, r.visiteurs || 0]; });
    if (out.length > 0) {
      sheet.getRange(2, 1, out.length, 2).setValues(out);
    }

    // Date/heure de MAJ en D1 (lue pour info)
    var dateStr = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');
    sheet.getRange('D1').setValue(dateStr);

    return ContentService.createTextOutput(JSON.stringify({status:'ok', rows: out.length})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status:'error', message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
