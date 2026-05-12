// ============================================================
// MAJ Dashboard Jour — Google Apps Script autonome
// Groupe Garcia — Alimente l'onglet Donnees_Jour + Historique_Challenges
// Consulte via : https://dref1969.github.io/dashboard-groupe-garcia/Dashboard_Jour_Garcia.html
// ============================================================

var BOUTIQUES_JOUR = [
  { code:'CHOLET', nom:'Cholet',     url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c40465507d9f65b951be6a989675e6fb' },
  { code:'VLR',    nom:'Vendome',    url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c40494bfbfe3390202ddcb3ce0' },
  { code:'RLR',    nom:'Romorantin', url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4041d528ebcf9b79f23421541' },
  { code:'CLR',    nom:'Chateaudun', url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404058bbdb7fa0487f70a715f' },
  { code:'TLR',    nom:'Amboise',    url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404c3b6394baabd91de729906' },
  { code:'ALR',    nom:'Angers',     url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4043d74c5faaeb5884e9af0d8' }
];

var SHEET_ID_JOUR       = '1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY';
var TAB_DONNEES_JOUR    = 'Donnees_Jour';
var TAB_HIST_CHALLENGES = 'Historique_Challenges';
var TAB_FACTURES_JOUR   = 'Factures_Jour';
var EXCLUS_TOP3         = ['HASSENE', 'LOUANE', 'ROMAIN GP'];

// Boosters MARGE Assurance injectes ponctuellement (retroactif Chubb, etc.)
// A retirer UNIQUEMENT du calcul des challenges (top 3, Amboise, Cholet, Groupe).
// L affichage du dashboard et les classements continuent d utiliser la marge totale.
// Date de validite : injection du 12/05/2026 - vider apres la journee.
// Format : { 'NOM_VENDEUR_3GWIN': montant_euros }
var BOOSTERS_CHALLENGE = {
  'ANAIS':     490,
  'MEHDY':     40,
  'CHLOE R':   90,
  'EMMY':      150,
  'LUCAS':     330,
  'HASSENE':   840,
  'ILIAN':     80,
  'JULIE TLR': 240,
  'NATHAN':    80
};

// URL 3GWIN des factures detaillees du jour (vraie marge + modele mobile par ligne)
var URL_FACTURES_JOUR   = 'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404436921c92d9e664263e8bee98e787b33d8de0edc0dc5a6dc669883ebefbb136e0d183374ea';

// URL 3GWIN "Mags jour" : agregats canoniques 6 boutiques + RESULTAT AG
// Avantage : roll-over automatique du jour cote 3GWIN (les 6 pages "Vendeurs jour"
// par boutique restent figees sur le dernier jour ouvre tant qu une cloture n est
// pas faite, ce qui causait l affichage des chiffres samedi le lundi matin).
var URL_MAGS_JOUR       = 'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c40442be11aa6633126bc5664215';

// Mapping NOM 3GWIN -> code interne
var NOM_TO_CODE_JOUR = {
  'AMBOISE':    'TLR',
  'ANGERS':     'ALR',
  'CHATEAUDUN': 'CLR',
  'CHOLET':     'CHOLET',
  'ROMORANTIN': 'RLR',
  'VENDOME':    'VLR'
};

var INDIC_JOUR = {
  'TOTAL BOX':              'box',
  'MARGE BOX':              'margeBox',
  'BOX MIGRATION':          'boxMig',
  'Total Mobiles Hors W2S': 'mob',
  'Assu Chubb':             'assu',
  'SFR CYBERSECU':          'cyber',
  'G3A':                    'g3a',
  'Marge Access':           'access',
  'Marge Assu':             'margeAssu',
  'Presta/services':        'margeServices',
  'MARGE TOTALE':           'marge',
  'TOTAL ABO':              'abo'
};


// ---- POINT D ENTREE PRINCIPAL -----------------------------

function majDashboardJour() {
  var start = new Date();

  // FENETRE D EXECUTION : lundi-samedi, 10h00-20h00 (Europe/Paris)
  // Hors fenetre, on sort immediatement sans scraper (evite les scrapes partiels nocturnes).
  // Contournement manuel : appeler majDashboardJour_force() pour bypasser ce garde-fou.
  if (!majDashboardJour.__force) {
    var tzNow  = new Date(Utilities.formatDate(start, 'Europe/Paris', 'yyyy/MM/dd HH:mm:ss'));
    var jour   = tzNow.getDay();   // 0 = dimanche, 6 = samedi
    var heure  = tzNow.getHours();
    if (jour === 0 || heure < 10 || heure >= 20) {
      Logger.log('Hors fenetre (jour=' + jour + ' heure=' + heure + ') - skip');
      return;
    }
  }

  // 0. Nettoyage defensif doublons Historique_Challenges (leger, sans impact perf)
  try { nettoyerDoublonsChallenges_silent_(); } catch(_) {}

  // 1. Scrape les 6 boutiques
  var allVendeurs = {};
  var magsData    = {};
  var erreurs     = [];

  for (var b = 0; b < BOUTIQUES_JOUR.length; b++) {
    var boutique = BOUTIQUES_JOUR[b];
    try {
      var html   = fetchPageJour_(boutique.url);
      var parsed = parsePageJour_(html);
      if (!parsed) {
        // Page vide ou "Erreur item n existe plus" — boutique a 0
        magsData[boutique.code] = emptyMag_(boutique);
        continue;
      }

      magsData[boutique.code] = {
        code:          boutique.code,
        nom:           boutique.nom,
        marge:         parsed.resultat.marge         || 0,
        mob:           parsed.resultat.mob           || 0,
        box:           parsed.resultat.box           || 0,
        margeBox:      parsed.resultat.margeBox      || 0,
        boxMig:        parsed.resultat.boxMig        || 0,
        assu:          parsed.resultat.assu          || 0,
        cyber:         parsed.resultat.cyber         || 0,
        g3a:           parsed.resultat.g3a           || 0,
        access:        parsed.resultat.access        || 0,
        margeAssu:     parsed.resultat.margeAssu     || 0,
        margeServices: parsed.resultat.margeServices || 0,
        abo:           parsed.resultat.abo           || 0
      };

      var noms = Object.keys(parsed.vendeurs);
      for (var n = 0; n < noms.length; n++) {
        var nom    = noms[n];
        var indics = parsed.vendeurs[nom];
        if (!allVendeurs[nom]) {
          allVendeurs[nom] = { nom:nom, marge:0, mob:0, box:0, assu:0, cyber:0, g3a:0, access:0, margeAssu:0, margeServices:0, abo:0, parBoutique:{} };
        }
        var v = allVendeurs[nom];
        v.marge         += indics.marge         || 0;
        v.mob           += indics.mob           || 0;
        v.box           += indics.box           || 0;
        v.assu          += indics.assu          || 0;
        v.cyber         += indics.cyber         || 0;
        v.g3a           += indics.g3a           || 0;
        v.access        += indics.access        || 0;
        v.margeAssu     += indics.margeAssu     || 0;
        v.margeServices += indics.margeServices || 0;
        v.abo           += indics.abo           || 0;
        v.parBoutique[boutique.code] = (v.parBoutique[boutique.code] || 0) + (indics.marge || 0);
      }
    } catch(e) {
      erreurs.push(boutique.nom + ': ' + e.message);
      magsData[boutique.code] = emptyMag_(boutique);
    }
  }

  // Completer les boutiques manquantes par des zeros
  for (var bi = 0; bi < BOUTIQUES_JOUR.length; bi++) {
    if (!magsData[BOUTIQUES_JOUR[bi].code]) magsData[BOUTIQUES_JOUR[bi].code] = emptyMag_(BOUTIQUES_JOUR[bi]);
  }

  // 1bis. Override magsData avec la vue "Mags jour" 3GWIN (canonique)
  // Les 6 pages "Vendeurs jour" par boutique restent figees tant qu une cloture
  // n est pas faite cote boutique (ex: lundi matin elles montrent encore samedi).
  // La vue "Mags jour" elle bascule automatiquement a minuit cote 3GWIN.
  try {
    var mjHtml = fetchPageJour_(URL_MAGS_JOUR);
    var mjData = parseMagsViewJour_(mjHtml);
    var mjKeys = ['marge','mob','box','margeBox','boxMig','assu','cyber','g3a','access','margeAssu','margeServices','abo'];
    for (var mc in magsData) {
      var mj = mjData[mc];
      if (!mj) continue;
      for (var ki = 0; ki < mjKeys.length; ki++) {
        var k = mjKeys[ki];
        if (typeof mj[k] === 'number' && !isNaN(mj[k])) magsData[mc][k] = mj[k];
      }
    }
  } catch(mje) {
    erreurs.push('MagsJour: ' + mje.message);
  }

  // 2. Boutique principale par vendeur (marge max du jour)
  var vendeursArray = [];
  var nomsList = Object.keys(allVendeurs);
  for (var i = 0; i < nomsList.length; i++) {
    var v = allVendeurs[nomsList[i]];
    var mainCode = BOUTIQUES_JOUR[0].code;
    var maxMarge = -Infinity;
    var codes = Object.keys(v.parBoutique);
    for (var c = 0; c < codes.length; c++) {
      if (v.parBoutique[codes[c]] > maxMarge) {
        maxMarge = v.parBoutique[codes[c]];
        mainCode = codes[c];
      }
    }
    vendeursArray.push({
      nom:           v.nom,
      bou:           mainCode,
      marge:         round2_(v.marge),
      mob:           Math.round(v.mob),
      box:           Math.round(v.box),
      cyber:         Math.round(v.cyber),
      assu:          Math.round(v.assu),
      g3a:           Math.round(v.g3a),
      access:        round2_(v.access),
      margeAssu:     round2_(v.margeAssu),
      margeServices: round2_(v.margeServices),
      abo:           Math.round(v.abo)
    });
  }
  vendeursArray.sort(function(a,b){ return b.marge - a.marge; });

  // 3. Ecriture dans l onglet Donnees_Jour
  var now = new Date();
  var dateStr  = Utilities.formatDate(now, 'Europe/Paris', 'dd/MM/yyyy');
  var heureStr = Utilities.formatDate(now, 'Europe/Paris', 'HH:mm');

  var ss = SpreadsheetApp.openById(SHEET_ID_JOUR);
  var sh = ss.getSheetByName(TAB_DONNEES_JOUR);
  if (!sh) sh = ss.insertSheet(TAB_DONNEES_JOUR);

  var headers = ['Type','Code','Nom','Marge','Mob','Box','Cyber','Assu','G3A','Access','MargeAssu','MargeServices','Abo','MargeBox','BoxMig','Date','Heure'];
  var rows = [headers];
  rows.push(['META','','','','','','','','','','','','','','',dateStr,heureStr]);

  // MAGS triees par marge desc
  var magsList = Object.values(magsData).sort(function(a,b){ return b.marge - a.marge; });
  for (var m = 0; m < magsList.length; m++) {
    var mg = magsList[m];
    rows.push(['MAG', mg.code, mg.nom, mg.marge, mg.mob, mg.box, mg.cyber, mg.assu, mg.g3a, mg.access, mg.margeAssu, mg.margeServices, mg.abo, mg.margeBox||0, mg.boxMig||0, '', '']);
  }

  // VENDEURS (pas de margeBox/boxMig au niveau vendeur — colonnes vides)
  for (var vi = 0; vi < vendeursArray.length; vi++) {
    var vd = vendeursArray[vi];
    rows.push(['VENDEUR', vd.nom, vd.bou, vd.marge, vd.mob, vd.box, vd.cyber, vd.assu, vd.g3a, vd.access, vd.margeAssu, vd.margeServices, vd.abo, '', '', '', '']);
  }

  sh.clearContents();
  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  // Forcer les colonnes numeriques en format nombre (eviter auto-detection date par Google Sheets)
  if (rows.length > 1) {
    sh.getRange(2, 4, rows.length-1, 9).setNumberFormat('0.##');   // D..L : Marge, Mob, Box, Cyber, Assu, G3A, Access, MargeAssu, MargeServices
    sh.getRange(2, 13, rows.length-1, 1).setNumberFormat('0');      // M : Abo
    sh.getRange(2, 14, rows.length-1, 2).setNumberFormat('0.##');   // N..O : MargeBox, BoxMig
  }

  // 4. Challenges
  var chResult = calculerChallenges_(magsList, vendeursArray);
  ecrireChallenges_(ss, dateStr, chResult);

  // 4bis. Factures detaillees (vraie marge par mobile + modele)
  var facturesInfo = { nbLignes: 0, nbMobiles: 0 };
  try {
    facturesInfo = majFactures_(ss, dateStr, heureStr);
  } catch(fe) {
    erreurs.push('Factures: ' + fe.message);
  }

  // 5. Log
  var duree    = ((new Date() - start) / 1000).toFixed(1);
  var margeGrp = magsList.reduce(function(s,m){ return s + m.marge; }, 0);
  var mobGrp   = magsList.reduce(function(s,m){ return s + m.mob; }, 0);

  var msg = 'MAJ Dashboard Jour — ' + dateStr + ' ' + heureStr
    + '\nDuree : ' + duree + 's'
    + '\nMarge jour : ' + margeGrp.toFixed(2) + ' | Mobiles : ' + mobGrp
    + '\nMags : ' + magsList.length + ' | Vendeurs : ' + vendeursArray.length
    + '\nFactures : ' + facturesInfo.nbLignes + ' lignes, ' + facturesInfo.nbMobiles + ' mobiles'
    + '\nChallenges : Top3=[' + chResult.top3_gagnes.join(',') + '] TLR=' + (chResult.amboise_won?'OUI':'NON')
    + ' CHOLET=' + (chResult.louane_won?'OUI':'NON') + ' GROUPE=' + (chResult.groupe_won?'OUI':'NON');

  if (erreurs.length) msg += '\nErreurs : ' + erreurs.join(' | ');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('MAJ Dashboard Jour', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch(_) {}

  return { mags:magsList, vendeurs:vendeursArray, challenges:chResult };
}


// ---- PARSING HTML JOUR (identique au mensuel) -------------

function parsePageJour_(html) {
  var cells = [];
  var re    = /<p[^>]*>\s*([\s\S]*?)\s*<\/p>/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var txt = m[1].replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/<[^>]+>/g,'').trim();
    if (txt) cells.push(txt);
  }
  if (!cells.length) return null;

  // Ignorer les pages avec "Cet item n existe plus" sans RESULTAT
  if (html.indexOf("Cet item n'existe plus") >= 0 && html.indexOf('RESULTAT') < 0) return null;

  var hStart = -1;
  for (var i = 0; i < cells.length; i++) {
    if (cells[i].indexOf('VENDEUR ') === 0) { hStart = i; break; }
  }
  if (hStart < 0) return null;

  var ncols = 0;
  for (var j = hStart + 1; j < Math.min(hStart + 25, cells.length); j++) {
    if (cells[j].indexOf('RESULTAT') === 0) { ncols = j - hStart + 1; break; }
  }
  if (!ncols) return null;

  var vendeurs = cells.slice(hStart + 1, hStart + ncols - 1);
  // Filtrer les cellules vides ou "Erreur" (page sans vendeur actif du jour)
  var vendeursValides = [];
  var vendeursIndex   = []; // position dans le tableau
  for (var vi2 = 0; vi2 < vendeurs.length; vi2++) {
    var n = vendeurs[vi2];
    if (n && n.indexOf('Erreur') < 0 && n.indexOf('existe plus') < 0) {
      vendeursValides.push(n);
      vendeursIndex.push(vi2);
    }
  }

  var rows = {};
  for (var r = hStart + ncols; r + ncols <= cells.length; r += ncols) {
    rows[cells[r]] = cells.slice(r + 1, r + ncols);
  }

  var result = { vendeurs:{}, resultat:{} };
  var labels = Object.keys(INDIC_JOUR);

  for (var li = 0; li < labels.length; li++) {
    var label = labels[li];
    var cle   = INDIC_JOUR[label];
    var row   = rows[label];
    if (!row) {
      var keys = Object.keys(rows);
      for (var ki = 0; ki < keys.length; ki++) {
        if (keys[ki].toLowerCase() === label.toLowerCase()) { row = rows[keys[ki]]; break; }
      }
    }
    if (!row) continue;

    for (var kv = 0; kv < vendeursValides.length; kv++) {
      var vnom = vendeursValides[kv];
      var vIdx = vendeursIndex[kv];
      if (!result.vendeurs[vnom]) result.vendeurs[vnom] = {};
      result.vendeurs[vnom][cle] = parseValJour_(row[vIdx]);
    }
    result.resultat[cle] = parseValJour_(row[vendeurs.length]);
  }

  return result;
}

// Parse la page "Mags jour" (6 boutiques en colonnes + RESULTAT AG).
// Retourne { TLR:{marge,mob,...}, ALR:{...}, ... }
function parseMagsViewJour_(html) {
  var parsed = parsePageJour_(html);
  if (!parsed) return {};
  var result = {};
  var noms = Object.keys(parsed.vendeurs);
  for (var i = 0; i < noms.length; i++) {
    var nom  = noms[i];
    var code = NOM_TO_CODE_JOUR[nom];
    if (code) result[code] = parsed.vendeurs[nom];
  }
  return result;
}

function parseValJour_(str) {
  if (!str) return 0;
  var n = parseFloat(String(str).replace(/[euros%\s]/g,'').replace(',','.'));
  return isNaN(n) ? 0 : n;
}


// ---- CHALLENGES -------------------------------------------

function calculerChallenges_(mags, vendeurs) {
  // Boutiques exclues du jour :
  //  - Lundi : RLR + CLR fermees (chiffres samedi reliquat dans 3GWIN)
  //  - Jours feries : seul Cholet travaille (toutes les autres sont fermees)
  var FERIES_FR = ['01/01/2026','06/04/2026','01/05/2026','08/05/2026','14/05/2026','25/05/2026','14/07/2026','15/08/2026','01/11/2026','11/11/2026','25/12/2026'];
  var nowChal = new Date();
  var dateChal = Utilities.formatDate(nowChal, 'Europe/Paris', 'dd/MM/yyyy');
  var BOU_EXCLUES = [];
  if (nowChal.getDay() === 1) BOU_EXCLUES = ['RLR','CLR'];
  if (FERIES_FR.indexOf(dateChal) >= 0) BOU_EXCLUES = ['ALR','TLR','CLR','RLR','VLR']; // Seul Cholet ouvert

  var magsFiltres = mags.filter(function(m){ return BOU_EXCLUES.indexOf(m.code) < 0; });
  var vendeursFiltres = vendeurs.filter(function(v){ return BOU_EXCLUES.indexOf(v.bou) < 0; });

  // Helper : marge effective d un vendeur (apres deduction du booster eventuel)
  function eff(v){ return (v.marge || 0) - (BOOSTERS_CHALLENGE[v.nom] || 0); }

  // Helper : somme des boosters des vendeurs rattaches a une boutique donnee
  function boostBou(code){
    var total = 0;
    for (var i = 0; i < vendeursFiltres.length; i++) {
      if (vendeursFiltres[i].bou === code) total += (BOOSTERS_CHALLENGE[vendeursFiltres[i].nom] || 0);
    }
    return total;
  }

  // Top 3 : vendeurs SAUF exclus, tries par marge effective desc
  var eligibles = vendeursFiltres.filter(function(v){ return EXCLUS_TOP3.indexOf(v.nom) < 0; });
  eligibles.sort(function(a,b){ return eff(b) - eff(a); });
  var top3 = eligibles.slice(0, 3).map(function(v){ return v.nom; });
  var top3_gagnes = eligibles.slice(0, 3).filter(function(v){ return eff(v) >= 400; }).map(function(v){ return v.nom; });

  // Hassene / Amboise (TLR exclu si ferie) — marge TLR moins boosters TLR
  var tlr = magsFiltres.find(function(m){ return m.code === 'TLR'; }) || { marge:0 };
  var tlrEff = (tlr.marge || 0) - boostBou('TLR');
  var amboise_won = tlrEff >= 700;

  // Louane / Cholet — marge CHOLET moins boosters CHOLET
  var cholet = magsFiltres.find(function(m){ return m.code === 'CHOLET'; }) || { marge:0 };
  var choletEff = (cholet.marge || 0) - boostBou('CHOLET');
  var louane_won = choletEff >= 1000;

  // Romain / Groupe — somme marge boutiques moins somme boosters de toutes les boutiques retenues
  var margeGroupe = magsFiltres.reduce(function(s,m){ return s + m.marge; }, 0);
  var boostGroupe = magsFiltres.reduce(function(s,m){ return s + boostBou(m.code); }, 0);
  var margeGroupeEff = margeGroupe - boostGroupe;
  var groupe_won = margeGroupeEff >= 4000;

  return {
    top3: top3,
    top3_gagnes: top3_gagnes,
    amboise_marge: round2_(tlrEff),
    amboise_won: amboise_won,
    louane_marge: round2_(choletEff),
    louane_won: louane_won,
    groupe_marge: round2_(margeGroupeEff),
    groupe_won: groupe_won
  };
}

// Normalise une valeur de cellule Date ou string en format 'dd/MM/yyyy'
function normDate_(cellVal) {
  if (cellVal instanceof Date) {
    return Utilities.formatDate(cellVal, 'Europe/Paris', 'dd/MM/yyyy');
  }
  return String(cellVal || '').trim();
}

function ecrireChallenges_(ss, dateStr, ch) {
  var sh = ss.getSheetByName(TAB_HIST_CHALLENGES);
  if (!sh) {
    sh = ss.insertSheet(TAB_HIST_CHALLENGES);
    sh.getRange(1,1,1,9).setValues([[
      'Date','Top3','Top3_Gagnes','Amboise_Marge','Amboise_Won','Louane_Marge','Louane_Won','Groupe_Marge','Groupe_Won'
    ]]);
  }

  var row = [
    dateStr,
    ch.top3.join(','),
    ch.top3_gagnes.join(','),
    String(ch.amboise_marge).replace('.', ','),
    ch.amboise_won ? 'OUI' : 'NON',
    String(ch.louane_marge).replace('.', ','),
    ch.louane_won ? 'OUI' : 'NON',
    String(ch.groupe_marge).replace('.', ','),
    ch.groupe_won ? 'OUI' : 'NON'
  ];

  // 1. Dedoublonner les doublons existants pour cette date (ne garder que la DERNIERE occurrence)
  var lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    var dates     = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    var matchRows = []; // index 0-based dans le tableau dates
    for (var i = 0; i < dates.length; i++) {
      if (normDate_(dates[i][0]) === dateStr) matchRows.push(i);
    }

    if (matchRows.length > 0) {
      // Mettre a jour la derniere occurrence
      var keepIdx = matchRows[matchRows.length - 1];

      // PROTECTION ANTI-SCRAPE-PARTIEL :
      // Ne remplacer la ligne existante que si le nouveau scrape a une groupe_marge
      // >= a celle deja stockee. Evite qu un scrape tardif/partiel (page 3GWIN vide)
      // n ecrase un scrape precedent plus complet de la meme journee.
      var existingGroupe = parseFloat(String(sh.getRange(keepIdx + 2, 8).getValue() || '0').replace(',', '.')) || 0;
      var newGroupe = parseFloat(ch.groupe_marge) || 0;

      // Sur lundi/ferie, on FORCE l'ecrasement : le plus petit groupe (Cholet seul / sans
      // RLR-CLR) est CORRECT, donc on ne doit pas conserver l'ancien chiffre incluant
      // les boutiques fermees.
      var FER_E = ['01/01/2026','06/04/2026','01/05/2026','08/05/2026','14/05/2026','25/05/2026','14/07/2026','15/08/2026','01/11/2026','11/11/2026','25/12/2026'];
      var dsE = Utilities.formatDate(new Date(),'Europe/Paris','dd/MM/yyyy');
      var jourSpec = ((new Date()).getDay() === 1) || (FER_E.indexOf(dsE) >= 0);

      if (newGroupe >= existingGroupe || jourSpec) {
        sh.getRange(keepIdx + 2, 1, 1, row.length).setValues([row]);
      } else {
        Logger.log('Scrape ignore pour ' + dateStr + ' : nouveau groupe=' + newGroupe + ' < stocke=' + existingGroupe);
      }
      // Supprimer toutes les autres occurrences (en partant de la fin)
      for (var d = matchRows.length - 2; d >= 0; d--) {
        sh.deleteRow(matchRows[d] + 2);
      }
      return;
    }
  }

  // Sinon ajouter une nouvelle ligne
  sh.getRange((sh.getLastRow() || 1) + 1, 1, 1, row.length).setValues([row]);
}


// Version silencieuse pour appel auto depuis majDashboardJour
function nettoyerDoublonsChallenges_silent_() {
  var ss = SpreadsheetApp.openById(SHEET_ID_JOUR);
  var sh = ss.getSheetByName(TAB_HIST_CHALLENGES);
  if (!sh) return 0;

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return 0;

  var data = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  var seen = {};
  var out  = [];
  for (var i = data.length - 1; i >= 0; i--) {
    var key = normDate_(data[i][0]);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.unshift(data[i]);
  }

  if (out.length === data.length) return 0; // deja propre

  sh.getRange(2, 1, lastRow - 1, 9).clearContent();
  if (out.length > 0) {
    sh.getRange(2, 1, out.length, 9).setValues(out);
  }
  Logger.log('Nettoyage auto challenges : ' + data.length + ' -> ' + out.length);
  return data.length - out.length;
}

// ONE-SHOT : corrige la ligne du 21/04/2026 (scrape 3GWIN partiel ce jour-la)
// Donnees reelles depuis l export TABLEAU VENDEUR 21/04 TOUTES boutiques :
//   NATHAN 462.64, ANAIS 461.95, EMILIE 342.54, LUCAS 313.70, MEHDY 308.91,
//   WILL 203, AXEL 133 (managers exclus)
//   Marge groupe reelle : 2992.05 €
function corrigerLigne21Avril() {
  var ss = SpreadsheetApp.openById(SHEET_ID_JOUR);
  var sh = ss.getSheetByName(TAB_HIST_CHALLENGES);
  if (!sh) { Logger.log('Onglet introuvable'); return; }

  var lastRow = sh.getLastRow();
  var dates   = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  var target  = -1;
  for (var i = 0; i < dates.length; i++) {
    if (normDate_(dates[i][0]) === '21/04/2026') { target = i + 2; break; }
  }
  if (target < 0) { Logger.log('Ligne 21/04 introuvable'); return; }

  // On conserve Amboise_Marge et Louane_Marge existants (inconnus sans export boutique)
  var oldAmboiseMarge = sh.getRange(target, 4).getValue();
  var oldLouaneMarge  = sh.getRange(target, 6).getValue();

  var corrected = [
    '21/04/2026',
    'NATHAN,ANAIS,EMILIE',
    'NATHAN,ANAIS',
    oldAmboiseMarge,
    'NON',
    oldLouaneMarge,
    'NON',
    '2992,05',
    'NON'
  ];
  sh.getRange(target, 1, 1, 9).setValues([corrected]);

  var msg = 'Ligne 21/04 corrigee : Top3=NATHAN,ANAIS,EMILIE | Gagnants=NATHAN,ANAIS | Groupe=2992,05 €';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Correction 21/04', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch(_) {}
}


// Nettoie TOUS les doublons du Sheet Historique_Challenges (a appeler une fois manuellement)
function nettoyerDoublonsChallenges() {
  var ss = SpreadsheetApp.openById(SHEET_ID_JOUR);
  var sh = ss.getSheetByName(TAB_HIST_CHALLENGES);
  if (!sh) return;

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return;

  var data = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  var seen = {};
  var out  = [];
  // On garde la DERNIERE occurrence de chaque date
  for (var i = data.length - 1; i >= 0; i--) {
    var key = normDate_(data[i][0]);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.unshift(data[i]);
  }

  // Reecriture complete : effacer puis re-ecrire
  sh.getRange(2, 1, lastRow - 1, 9).clearContent();
  if (out.length > 0) {
    sh.getRange(2, 1, out.length, 9).setValues(out);
  }

  Logger.log('Nettoyage challenges : ' + data.length + ' lignes -> ' + out.length + ' uniques');
  try { SpreadsheetApp.getUi().alert('Nettoyage Historique_Challenges', data.length + ' lignes -> ' + out.length + ' uniques', SpreadsheetApp.getUi().ButtonSet.OK); } catch(_) {}
}


// ---- FACTURES DETAILLEES (vraie marge + modele mobile) ----

function majFactures_(ss, dateStr, heureStr) {
  var html  = fetchPageJour_(URL_FACTURES_JOUR);
  var lines = parseFacturesHtml_(html);

  // 1. Grouper les lignes par N° facture
  var factures = {}; // numFac -> { vendeur, boutique, totalMarge, hasMobile, lignes: [...] }
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (!factures[l.numFac]) {
      factures[l.numFac] = {
        numFac: l.numFac, vendeur: l.vendeur, boutique: l.boutique,
        client: l.client, totalMarge: 0, hasMobile: false, lignes: [], mobiles: []
      };
    }
    var f = factures[l.numFac];
    f.totalMarge += l.marge;
    f.lignes.push(l);
    // On compte uniquement les mobiles HORS Web to Shop (W2S = commande web)
    if (l.famille === 'MOBILE' && !l.w2s) {
      f.hasMobile = true;
      f.mobiles.push({ codeArticle: l.codeArticle, modele: l.designation, margeMobile: l.marge });
    }
  }

  // 2. Agregation par vendeur
  var agg = {};
  var mobilesDetail = []; // detail par mobile vendu avec marge facture complete

  var facNums = Object.keys(factures);
  for (var fn = 0; fn < facNums.length; fn++) {
    var fac = factures[facNums[fn]];
    if (!agg[fac.vendeur]) {
      agg[fac.vendeur] = {
        vendeur: fac.vendeur, boutique: fac.boutique,
        nbFactures: 0, totalMarge: 0,
        nbFactMobile: 0, margeFactMobile: 0, // factures contenant un mobile
        nbMobiles: 0 // nombre de telephones vendus
      };
    }
    var v = agg[fac.vendeur];
    v.nbFactures++;
    v.totalMarge += fac.totalMarge;

    if (fac.hasMobile) {
      v.nbFactMobile++;
      v.margeFactMobile += fac.totalMarge;
      v.nbMobiles += fac.mobiles.length;

      // Detail : pour chaque mobile, associer la marge de la facture entiere
      // Si plusieurs mobiles sur la meme facture, on divise la marge facture
      var nbMobFac = fac.mobiles.length;
      var margeFacParMob = fac.totalMarge / nbMobFac;
      for (var mi = 0; mi < nbMobFac; mi++) {
        var mob = fac.mobiles[mi];
        mobilesDetail.push({
          vendeur: fac.vendeur, boutique: fac.boutique,
          numFac: fac.numFac, modele: mob.modele,
          margeMobileSeul: mob.margeMobile,
          margeFactureTotale: fac.totalMarge,
          margeAllouee: margeFacParMob // si plusieurs mobiles sur meme facture
        });
      }
    }
  }

  // 3. Ecriture sheet
  var sh = ss.getSheetByName(TAB_FACTURES_JOUR);
  if (!sh) sh = ss.insertSheet(TAB_FACTURES_JOUR);

  var headers = [
    'Type','Vendeur','Boutique','NumFac','Modele',
    'NbFactures','NbFactMobile','NbMobiles',
    'MargeTotale','MargeFactMobile',
    'MargeMobileSeul','MargeFactureTotale','MargeAllouee',
    'MargeParMobile','MargeParFacture',
    'Date','Heure'
  ];
  var rows = [headers];
  rows.push(['META','','','','','','','','','','','','','','', dateStr, heureStr]);

  // SUMMARY : 1 ligne par vendeur
  // MargeParMobile = somme marge factures avec mobile / nb mobiles vendus
  // MargeParFacture = marge totale / nb factures
  var vendeurNoms = Object.keys(agg).sort();
  for (var vn = 0; vn < vendeurNoms.length; vn++) {
    var v = agg[vendeurNoms[vn]];
    var margeParMob = v.nbMobiles > 0 ? round2_(v.margeFactMobile / v.nbMobiles) : 0;
    var margeParFac = v.nbFactures > 0 ? round2_(v.totalMarge / v.nbFactures) : 0;
    rows.push([
      'SUMMARY', v.vendeur, v.boutique, '', '',
      v.nbFactures, v.nbFactMobile, v.nbMobiles,
      round2_(v.totalMarge), round2_(v.margeFactMobile),
      '', '', '',
      margeParMob, margeParFac, '', ''
    ]);
  }

  // MOBILE detail : 1 ligne par telephone vendu (avec marge facture complete)
  mobilesDetail.sort(function(a,b){ return b.margeFactureTotale - a.margeFactureTotale; });
  for (var md = 0; md < mobilesDetail.length; md++) {
    var m = mobilesDetail[md];
    rows.push([
      'MOBILE', m.vendeur, m.boutique, m.numFac, m.modele,
      '', '', '',
      '', '',
      round2_(m.margeMobileSeul), round2_(m.margeFactureTotale), round2_(m.margeAllouee),
      '', '', '', ''
    ]);
  }

  sh.clearContents();
  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  if (rows.length > 2) {
    sh.getRange(3, 6, rows.length-2, 10).setNumberFormat('0.##');
  }

  return { nbLignes: lines.length, nbMobiles: mobilesDetail.length, nbFactMobile: mobilesDetail.length };
}


function parseFacturesHtml_(html) {
  var trMatches = html.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  var lines = [];
  for (var t = 0; t < trMatches.length; t++) {
    var cells = [];
    var re = /<p[^>]*>([^<]*)<\/p>/g;
    var m;
    while ((m = re.exec(trMatches[t])) !== null) {
      cells.push(m[1].replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim());
    }
    // On garde uniquement les lignes qui ressemblent a une facture
    if (cells.length < 27) continue;
    var entete = cells[6];
    if (entete !== 'FACTURE' && entete !== 'AVOIR') continue;
    if (!cells[4] || !cells[11]) continue; // besoin vendeur + famille

    // Detection Web to Shop : col 47 (N Commande W2S) est renseignee uniquement pour les W2S
    var nCmd47 = (cells[47] || '').trim();
    var isW2S  = nCmd47.length > 0;

    lines.push({
      date:        cells[1],
      heure:       cells[2],
      boutique:    cells[3],
      vendeur:     cells[4],
      client:      cells[5],
      entete:      entete,
      numFac:      cells[7],
      codeArticle: cells[9],
      designation: (cells[10] || '').replace(/\s+/g, ' ').substring(0, 60),
      famille:     cells[11],
      marge:       parseFloat(String(cells[26]).replace(',','.')) || 0,
      w2s:         isW2S
    });
  }
  return lines;
}


// ---- HELPERS ----------------------------------------------

function emptyMag_(boutique) {
  return { code:boutique.code, nom:boutique.nom, marge:0, mob:0, box:0, margeBox:0, boxMig:0, cyber:0, assu:0, g3a:0, access:0, margeAssu:0, margeServices:0, abo:0 };
}

function fetchPageJour_(url) {
  // Retry jusqu a 3 fois sur erreurs transitoires (HTTP 5xx, timeouts, erreurs serveur Google)
  var lastError;
  for (var attempt = 1; attempt <= 3; attempt++) {
    try {
      var resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: false
      });
      var code = resp.getResponseCode();
      if (code === 200) return resp.getContentText('UTF-8');
      if (code >= 500 && attempt < 3) {
        Utilities.sleep(2000 * attempt);
        continue;
      }
      throw new Error('HTTP ' + code);
    } catch(e) {
      lastError = e;
      if (attempt < 3 && isTransientError_(e)) {
        Utilities.sleep(2000 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

// Detecte les erreurs transitoires Google / reseau (a retenter)
function isTransientError_(e) {
  var msg = String((e && e.message) || e || '');
  return /server error|backend error|service is currently unavailable|service unavailable|timed out|deadline|temporarily unavailable|exception: service|address unavailable|503|502|504/i.test(msg);
}

function round2_(n) { return Math.round(n*100)/100; }


// ---- DECLENCHEURS -----------------------------------------

// Point d entree appele par le trigger : retry global sur erreurs serveur transitoires Google
// (ex : "We re sorry, a server error occurred. Please wait a bit and try again.")
// Idempotent : majDashboardJour fait clearContents + setValues + dedup, donc rejouable sans risque.
function majDashboardJour_trigger() {
  var lastError;
  for (var attempt = 1; attempt <= 3; attempt++) {
    try {
      return majDashboardJour();
    } catch(e) {
      lastError = e;
      if (attempt < 3 && isTransientError_(e)) {
        Logger.log('Tentative ' + attempt + ' echec transitoire, retry dans ' + (5*attempt) + 's : ' + e.message);
        Utilities.sleep(5000 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

function configurerTriggerJour() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    var h = triggers[t].getHandlerFunction();
    if (h === 'majDashboardJour' || h === 'majDashboardJour_trigger') ScriptApp.deleteTrigger(triggers[t]);
  }
  // Toutes les 5 minutes. La fenetre lundi-samedi 10h-20h est filtree dans majDashboardJour().
  // Le wrapper _trigger ajoute un retry global sur erreurs transitoires Google.
  ScriptApp.newTrigger('majDashboardJour_trigger').timeBased().everyMinutes(5).create();
  try { SpreadsheetApp.getUi().alert('Declencheur cree : MAJ Dashboard Jour toutes les 5 min (10h-20h lun-sam) avec retry'); } catch(_) {}
}

function supprimerTriggerJour() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t = 0; t < triggers.length; t++) {
    var h = triggers[t].getHandlerFunction();
    if (h === 'majDashboardJour' || h === 'majDashboardJour_trigger') ScriptApp.deleteTrigger(triggers[t]);
  }
  try { SpreadsheetApp.getUi().alert('Declencheur MAJ Dashboard Jour supprime'); } catch(_) {}
}

// Permet de forcer une execution hors fenetre (test manuel)
function majDashboardJour_force() {
  majDashboardJour.__force = true;
  try { majDashboardJour(); } finally { majDashboardJour.__force = false; }
}
