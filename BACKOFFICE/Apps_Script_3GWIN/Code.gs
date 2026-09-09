function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Dashboard Manager Groupe Garcia - Avril 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.type === 'dilax') return handleDilax(data);
    if (data.vendeurs || data.mags) return handleVendeurs(data);
    return ContentService.createTextOutput(JSON.stringify({success:false,error:'Type inconnu'})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success:false,error:err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleVendeurs(data) {
  var SID = '1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY';
  var ss = SpreadsheetApp.openById(SID);
  if (data.vendeurs) {
    var sh = ss.getSheetByName('Vendeurs_Mois'); if (!sh) sh = ss.insertSheet('Vendeurs_Mois');
    sh.clearContents();
    var hdr = ['Rang','Vendeur','Code','Boutique','Mob','Cyber','Assu','B2B','Marge','PM'];
    sh.getRange(1,1,1,hdr.length).setValues([hdr]);
    var rows = data.vendeurs.map(function(v){return[v.rang,v.nom,v.code,v.boutique,v.mob,v.cyber,v.assu,v.b2b,v.marge,v.pm];});
    if(rows.length>0) sh.getRange(2,1,rows.length,hdr.length).setValues(rows);
  }
  if (data.mags) {
    var sh2 = ss.getSheetByName('Mags_Mois'); if (!sh2) sh2 = ss.insertSheet('Mags_Mois');
    sh2.clearContents();
    var hdr2 = ['Rang','Boutique','Code','Mob','Cyber','Assu','B2B','Marge','PM'];
    sh2.getRange(1,1,1,hdr2.length).setValues([hdr2]);
    var rows2 = data.mags.map(function(m){return[m.rang,m.nom,m.code,m.mob,m.cyber,m.assu,m.b2b,m.marge,m.pm];});
    if(rows2.length>0) sh2.getRange(2,1,rows2.length,hdr2.length).setValues(rows2);
  }
  return ContentService.createTextOutput(JSON.stringify({success:true})).setMimeType(ContentService.MimeType.JSON);
}

function handleDilax(data) {
  var SID = '1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY';
  var ss = SpreadsheetApp.openById(SID);
  var sheet = ss.getSheetByName('DILAX');
  if (!sheet) { sheet = ss.insertSheet('DILAX'); }
  sheet.clearContents();
  var headers = ['Rang','Boutique','Code','Visiteurs','Marge','Mob HW2S','Cyber','Assurance','Panier Moyen','Taux Transfo (%)'];
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  var rows = data.boutiques.map(function(b){ return [b.rang,b.boutique,b.code,b.visiteurs,b.marge,b.mob,b.cyber,b.assu,b.pm,b.tx]; });
  if (rows.length > 0) { sheet.getRange(2,1,rows.length,headers.length).setValues(rows); }
  var t = data.total;
  sheet.getRange(rows.length+2,1,1,10).setValues([['','TOTAL GROUPE','',t.visiteurs,t.marge,t.mob,t.cyber,t.assu,t.pm,t.tx]]);
  sheet.getRange(rows.length+3,2,1,1).setValues([[data.date]]);
  return ContentService.createTextOutput(JSON.stringify({success:true,message:'DILAX mis a jour',count:rows.length})).setMimeType(ContentService.MimeType.JSON);
}