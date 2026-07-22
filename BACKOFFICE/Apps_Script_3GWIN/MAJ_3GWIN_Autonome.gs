// ============================================================
// MAJ 3GWIN — Google Apps Script autonome
// Groupe Garcia — Mise à jour Données_Commissions
// ============================================================
// INSTALLATION :
//   1. Ouvrir le Google Sheet Principal OU Garcia-Vendeurs
//   2. Extensions > Apps Script
//   3. Coller ce code (remplacer tout le contenu existant)
//   4. Sauvegarder (Ctrl+S)
//   5. Exécuter "onOpen" UNE FOIS pour créer le menu
//   6. Utiliser le menu "🔄 MAJ 3GWIN" > "▶ Lancer la mise à jour"
//
// TRIGGER AUTOMATIQUE (optionnel) :
//   Menu "🔄 MAJ 3GWIN" > "⚙️ Configurer le déclencheur auto"
//   → Exécutera la MAJ toutes les 2 heures automatiquement
// ============================================================

// ---- CONFIGURATION ----------------------------------------

var BOUTIQUES = [
  { code:'CHOLET', nom:'CHOLET',     url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c40465507d9f65b951bec70748469af0' },
  { code:'VLR',    nom:'VENDOME',    url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404bc7a3e54e47a5aa55283ce' },
  { code:'RLR',    nom:'ROMORANTIN', url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4046734a8c4171cd64e094cc6' },
  { code:'CLR',    nom:'CHATEAUDUN', url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4040854051b7ec0856f99066a' },
  { code:'TLR',    nom:'AMBOISE',    url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4045206ab8eb111d0a7a07a14' },
  { code:'ALR',    nom:'ANGERS',     url:'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404b6a74ec2d2bcc23e5db778' },
];

// LOUANE : RPV de CHOLET pour son payplan (gere cote garcia-vendeurs via
// RPV_STORES), mais ses ventes perso en renfort restent rattachees a ANGERS
// ici : elles ne doivent PAS gonfler les chiffres de Cholet. Elle est
// consideree vendeuse uniquement pour le challenge du jour (pipeline Jour).
// Decision Frederic 11/07/2026.
var RPV_VENDEURS = ['ROMAIN GP', 'LOUANE'];

var URL_SHEET_PRINCIPAL   = 'https://script.google.com/macros/s/AKfycbz2fJtcs1DOb7XEMk_jCdTBFus6bDkw73LzEVhrRLcCCWwhU77wZTJVuZvPheX5HO8ESA/exec';
var URL_SHEET_GARCIA_VEND = 'https://script.google.com/macros/s/AKfycbzjzvU76vwY5nbaqRGRnBBWNKq3lu82lQItNOPJ3ENqowhr22bSnfLW8w3MTsA2AD0o/exec';

// URL 3GWIN des factures detaillees du MOIS en cours (vraie marge + modele par ligne)
var URL_FACTURES_MOIS     = 'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404436921c92d9e664263e8bee98e787b33d8de0edc0dc5a6dcc615af6c5c9870ff7ce06c6748ab';
var URL_DETAIL_VENTES     = 'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CTX_7772-3-HBdpLrnPnK-908931BF/index/SYNC_100412531';

// URL 3GWIN "Mags mois" : agregats canoniques 6 boutiques + RESULTAT AG (source de verite des marges boutique)
var URL_MAGS_MOIS         = 'http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404d4b037891f8f0385ebf74d7b';

// Mapping NOM 3GWIN -> code interne (utilise par parseMagsView_)
var NOM_TO_CODE = {
  'AMBOISE':    'TLR',
  'ANGERS':     'ALR',
  'CHATEAUDUN': 'CLR',
  'CHOLET':     'CHOLET',
  'ROMORANTIN': 'RLR',
  'VENDOME':    'VLR'
};

var SHEET_ID_PRINCIPAL    = '1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY';
var TAB_FACTURES_MOIS     = 'Factures_Mois';

var INDICATEURS = {
  'TOTAL BOX':              'box',
  'MARGE BOX':              'margeBox',
  'TOTAL ABO':              'abo',
  'MARGE ABO':              'margeAbo',
  'BOX MIGRATION':          'boxMig',
  'Total Mobiles Hors W2S': 'mob',
  'Assu Chubb':             'assu',
  'SFR CYBERSECU':          'cyber',
  'G3A':                    'g3a',
  'Marge Access':           'access',
  'Marge Assu':             'margeAssu',
  'Presta/services':        'margeServices',
  'MARGE TOTALE':           'marge',
  'TRACKER':                'tracker'
};

var TAB_MAGS_DETAIL       = 'Mags_Mois_Detail';
var TAB_CONFIG            = 'Config';


// ---- POINT D ENTREE PRINCIPAL -----------------------------

function maj3GWIN() {
  var start   = new Date();
  var erreurs = [];

  // 1. Jours ouvres PAR BOUTIQUE (samedi ouvert partout, lundi = CHOLET+ALR,
  //    ferie = CHOLET seul, dimanche + 1er mai = tout ferme)
  var joursInfo   = calcJoursOuvres_();
  var joursParBou = joursInfo.parBoutique;
  var joursMax    = joursInfo.max;

  // 2. Jours travailles par vendeur depuis Objectifs_Indiv (echec bruyant)
  var joursTravailles = {};
  try {
    joursTravailles = getJoursTravailles_();
  } catch(je) {
    erreurs.push('JoursTravailles: ' + je.message);
  }

  // 3. Scraping des 6 boutiques
  var allVendeurs = {};
  var magsData    = [];

  for (var b = 0; b < BOUTIQUES.length; b++) {
    var boutique = BOUTIQUES[b];
    try {
      var html   = fetchPage_(boutique.url);
      var parsed = parsePage_(html);
      if (!parsed) { erreurs.push('Parse echoue : ' + boutique.nom); continue; }

      // Totaux boutique
      magsData.push({
        boutique:       boutique.nom,
        code:           boutique.code,
        marge:          parsed.resultat.marge         || 0,
        mob:            parsed.resultat.mob           || 0,
        box:            parsed.resultat.box           || 0,
        margeBox:       parsed.resultat.margeBox      || 0,
        abo:            parsed.resultat.abo           || 0,
        margeAbo:       parsed.resultat.margeAbo      || 0,
        boxMig:         parsed.resultat.boxMig        || 0,
        assu:           parsed.resultat.assu          || 0,
        cyber:          parsed.resultat.cyber         || 0,
        alba:           parsed.resultat.g3a           || 0,
        tracker:        parsed.resultat.tracker       || 0,
        access:         parsed.resultat.access        || 0,
        margeAssu:      parsed.resultat.margeAssu     || 0,
        margeServices:  parsed.resultat.margeServices || 0
      });

      // Vendeurs
      var noms = Object.keys(parsed.vendeurs);
      for (var n = 0; n < noms.length; n++) {
        var nom    = noms[n];
        var indics = parsed.vendeurs[nom];
        if (!allVendeurs[nom]) {
          allVendeurs[nom] = { nom:nom, marge:0, mob:0, box:0, assu:0, cyber:0, g3a:0, access:0, tracker:0, parBoutique:{} };
        }
        var v = allVendeurs[nom];
        v.marge   += indics.marge   || 0;
        v.mob     += indics.mob     || 0;
        v.box     += indics.box     || 0;
        v.assu    += indics.assu    || 0;
        v.cyber   += indics.cyber   || 0;
        v.g3a     += indics.g3a     || 0;
        v.access  += indics.access  || 0;
        v.tracker += indics.tracker || 0;
        v.parBoutique[boutique.code] = (v.parBoutique[boutique.code] || 0) + (indics.marge || 0);
      }
    } catch(e) {
      erreurs.push(boutique.nom + ': ' + e.message);
    }
  }

  // 3bis. Override marges boutique avec la vue "Mags mois" 3GWIN (canonique)
  // Les RESULTAT par page boutique peuvent diverger legerement de Mags mois
  // (boosters retroactifs, etc.). Mags mois est la source de verite affichee
  // par 3GWIN au manager. On override les champs sourcables, les autres restent
  // en fallback (RESULTAT par boutique).
  try {
    var mmHtml = fetchPage_(URL_MAGS_MOIS);
    var mmData = parseMagsView_(mmHtml);
    var mmKeys = ['marge','mob','box','margeBox','abo','margeAbo','boxMig','assu','cyber','tracker','access','margeAssu','margeServices'];
    for (var mi = 0; mi < magsData.length; mi++) {
      var mm = mmData[magsData[mi].code];
      if (!mm) continue;
      for (var ki = 0; ki < mmKeys.length; ki++) {
        var k = mmKeys[ki];
        if (typeof mm[k] === 'number' && !isNaN(mm[k])) magsData[mi][k] = mm[k];
      }
      // alba (champ historique = nb G3A) <- g3a de Mags mois
      if (typeof mm.g3a === 'number' && !isNaN(mm.g3a)) magsData[mi].alba = mm.g3a;
    }
  } catch(me) {
    erreurs.push('MagsMois: ' + me.message);
  }

  // 3ter. Factures detaillees MOIS (filtre uniquement les boosters MARGE retroactifs)
  var facturesInfo = { nbLignes: 0, nbMobiles: 0 };
  try {
    facturesInfo = majFacturesMois_();
  } catch(fe) {
    erreurs.push('FacturesMois: ' + fe.message);
  }

  // 4. Boutique principale = celle avec la marge max
  var vendeursList = [];
  var nomsList = Object.keys(allVendeurs);
  for (var i = 0; i < nomsList.length; i++) {
    var v = allVendeurs[nomsList[i]];
    var mainCode = BOUTIQUES[0].code;
    var maxMarge = -Infinity;
    var codes = Object.keys(v.parBoutique);
    for (var c = 0; c < codes.length; c++) {
      if (v.parBoutique[codes[c]] > maxMarge) {
        maxMarge = v.parBoutique[codes[c]];
        mainCode = codes[c];
      }
    }
    vendeursList.push({
      boutique: mainCode,
      nom:      v.nom,
      marge:    v.marge,
      mob:      v.mob,
      box:      v.box,
      g3a:      v.g3a,
      cyber:    v.cyber,
      assu:     v.assu,
      access:   v.access
    });
  }

  // 5. Formater payload (K/L = jours ouvres de la boutique du vendeur)
  var vendeurs = [];
  for (var j = 0; j < vendeursList.length; j++) {
    var v = vendeursList[j];
    var jb    = joursParBou[v.boutique] || joursMax;
    var jTrav = joursTravailles[(v.nom || '').toUpperCase()] || jb.total;
    vendeurs.push({
      A: v.boutique,
      B: v.nom,
      C: RPV_VENDEURS.indexOf(v.nom) >= 0 ? 'RPV' : 'Vendeur',
      D: round2_(v.marge),
      E: Math.round(v.mob),
      F: Math.round(v.g3a),
      G: Math.round(v.cyber),
      H: Math.round(v.assu),
      I: Math.round(v.mob),
      J: round2_(v.access),
      K: jb.ecoules,
      L: jb.total,
      M: jTrav
    });
  }

  var payload = { vendeurs: vendeurs, mags: magsData };

  // 6. Envoi POST aux 2 APIs
  var r1 = postApi_(URL_SHEET_PRINCIPAL,   payload);
  var r2 = postApi_(URL_SHEET_GARCIA_VEND, payload);

  // 6bis. Colonnes N:O (MobHorsW2S/Box) de Données_Commissions :
  // le endpoint POST n'ecrit que A:M, on ecrit N:O directement ici
  // (alignees par nom de vendeur) et on purge les lignes orphelines.
  try {
    ecrireColonnesNO_(vendeursList);
  } catch(ne) {
    erreurs.push('ColonnesNO: ' + ne.message);
  }

  // 6ter. Ecriture onglet Mags_Mois_Detail (agregats 3GWIN par boutique)
  try {
    ecrireMagsDetail_(magsData);
  } catch(me) {
    erreurs.push('MagsDetail: ' + me.message);
  }

  // 6quater. MAJ Config!A2 (Mois en cours) + B2 (Derniere MAJ)
  try {
    ecrireConfigMois_();
  } catch(ce) {
    erreurs.push('Config: ' + ce.message);
  }

  // 7. Resume
  var duree    = ((new Date() - start) / 1000).toFixed(1);
  var margeGrp = 0;
  var mobGrp   = 0;
  for (var k = 0; k < magsData.length; k++) {
    margeGrp += magsData[k].marge;
    mobGrp   += magsData[k].mob;
  }

  var joursStr = [];
  for (var jbk in joursParBou) {
    joursStr.push(jbk + ' ' + joursParBou[jbk].ecoules + '/' + joursParBou[jbk].total);
  }

  var lignes = [
    'MAJ 3GWIN — ' + new Date().toLocaleString('fr-FR'),
    'Duree : ' + duree + 's | Jours ouvres : ' + joursStr.join(' | '),
    '',
    'Marge groupe : ' + margeGrp.toFixed(2) + ' euros | Mobiles : ' + mobGrp,
    'Vendeurs : ' + vendeurs.length + ' | Boutiques : ' + magsData.length,
    'Factures mois : ' + facturesInfo.nbLignes + ' lignes, ' + facturesInfo.nbMobiles + ' mobiles (Hors W2S)',
    '',
    'Sheet Principal       : ' + r1.status + ' (' + r1.rows + ' lignes)',
    'Sheet Garcia-Vendeurs : ' + r2.status + ' (' + r2.rows + ' lignes)'
  ];
  if (erreurs.length) {
    lignes.push('');
    lignes.push('Erreurs : ' + erreurs.join(' | '));
  }
  var msg = lignes.join('\n');

  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert('MAJ 3GWIN', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(_) {}

  return { r1:r1, r2:r2, vendeurs:vendeurs, mags:magsData };
}


// ---- PARSING HTML 3GWIN -----------------------------------

function parsePage_(html) {
  // Extraire tous les textes des <p> dans l'ordre
  var cells = [];
  var re    = /<p[^>]*>\s*([\s\S]*?)\s*<\/p>/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var txt = m[1].replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/<[^>]+>/g,'').trim();
    if (txt) cells.push(txt);
  }
  if (!cells.length) return null;

  // En-tete : chercher "VENDEUR "
  var hStart = -1;
  for (var i = 0; i < cells.length; i++) {
    if (cells[i].indexOf('VENDEUR ') === 0) { hStart = i; break; }
  }
  if (hStart < 0) return null;

  // Compter les colonnes (jusqu a "RESULTAT")
  var ncols = 0;
  for (var j = hStart + 1; j < Math.min(hStart + 25, cells.length); j++) {
    if (cells[j].indexOf('RESULTAT') === 0) { ncols = j - hStart + 1; break; }
  }
  if (!ncols) return null;

  // Noms vendeurs (header[1] ... header[ncols-2])
  var vendeurs = cells.slice(hStart + 1, hStart + ncols - 1);

  // Dictionnaire indicateur -> valeurs
  var rows = {};
  for (var r = hStart + ncols; r + ncols <= cells.length; r += ncols) {
    rows[cells[r]] = cells.slice(r + 1, r + ncols);
  }

  // Extraire les indicateurs voulus
  var result = { vendeurs:{}, resultat:{} };
  var labels = Object.keys(INDICATEURS);

  for (var li = 0; li < labels.length; li++) {
    var label = labels[li];
    var cle   = INDICATEURS[label];
    var row   = rows[label];

    if (!row) {
      // Recherche insensible a la casse
      var keys = Object.keys(rows);
      for (var ki = 0; ki < keys.length; ki++) {
        if (keys[ki].toLowerCase() === label.toLowerCase()) { row = rows[keys[ki]]; break; }
      }
    }
    if (!row) continue;

    for (var vi = 0; vi < vendeurs.length; vi++) {
      var vnom = vendeurs[vi];
      if (!result.vendeurs[vnom]) result.vendeurs[vnom] = {};
      result.vendeurs[vnom][cle] = parseVal_(row[vi]);
    }
    result.resultat[cle] = parseVal_(row[vendeurs.length]);
  }

  return result;
}

function parseVal_(str) {
  if (!str) return 0;
  var n = parseFloat(String(str).replace(/[euros%\s]/g,'').replace(',','.'));
  return isNaN(n) ? 0 : n;
}


// Parse la page "Mags mois" / "Mags jour" (6 boutiques en colonnes + RESULTAT AG).
// Reutilise parsePage_ : la structure est identique a une page boutique
// ou les "vendeurs" sont en fait les noms de boutiques.
// Retourne { TLR:{marge,mob,...}, ALR:{...}, CLR:{...}, CHOLET:{...}, RLR:{...}, VLR:{...} }
function parseMagsView_(html) {
  var parsed = parsePage_(html);
  if (!parsed) return {};
  var result = {};
  var noms = Object.keys(parsed.vendeurs);
  for (var i = 0; i < noms.length; i++) {
    var nom  = noms[i];
    var code = NOM_TO_CODE[nom];
    if (code) result[code] = parsed.vendeurs[nom];
  }
  return result;
}


// ---- JOURS OUVRES (PAR BOUTIQUE) ---------------------------
// Regle reelle d'ouverture (et non lundi-vendredi) :
//   - dimanche : tout ferme
//   - 1er mai : tout ferme
//   - jour ferie (hors 1er mai) : seule CHOLET ouvre
//   - lundi non ferie : CHOLET + ALR ouvrent (ALR depuis le 06/07/2026)
//   - mardi a samedi non ferie : toutes les boutiques ouvrent
// Retourne { parBoutique:{CODE:{total,ecoules}}, max:{total,ecoules} }

function calcJoursOuvres_() {
  var now   = new Date();
  var year  = now.getFullYear();
  var month = now.getMonth();

  var fixes = ['01-01','05-01','05-08','07-14','08-15','11-01','11-11','12-25'];

  // Paques (algorithme de Butcher)
  var a=year%19, b=Math.floor(year/100), c=year%100;
  var d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25);
  var g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
  var ii=Math.floor(c/4), k=c%4, l=(32+2*e+2*ii-h-k)%7;
  var mm=Math.floor((a+11*h+22*l)/451);
  var pM=Math.floor((h+l-7*mm+114)/31)-1;
  var pD=((h+l-7*mm+114)%31)+1;

  function addDays(yr,mo,dy,n){ var dt=new Date(yr,mo,dy); dt.setDate(dt.getDate()+n); return dt; }
  function fmt(dt){ return dt.getFullYear()+'-'+pad_(dt.getMonth()+1)+'-'+pad_(dt.getDate()); }

  var feries = {};
  for (var fi=0; fi<fixes.length; fi++) feries[year+'-'+fixes[fi]] = 1;
  feries[fmt(addDays(year,pM,pD,1))]  = 1; // Lundi de Paques
  feries[fmt(addDays(year,pM,pD,39))] = 1; // Ascension
  feries[fmt(addDays(year,pM,pD,50))] = 1; // Lundi de Pentecote

  var codes = [];
  for (var bi=0; bi<BOUTIQUES.length; bi++) codes.push(BOUTIQUES[bi].code);

  function boutiquesOuvertes(dt) {
    var w = dt.getDay();
    var fdt = fmt(dt);
    if (w === 0) return [];                    // dimanche : tout ferme
    if (fdt === year+'-05-01') return [];      // 1er mai : tout ferme
    if (feries[fdt]) return ['CHOLET'];        // ferie : Cholet seule
    if (w === 1) return ['CHOLET','ALR'];      // lundi : Cholet + Angers
    return codes;                              // mardi a samedi : toutes
  }

  var parBoutique = {};
  for (var ci=0; ci<codes.length; ci++) parBoutique[codes[ci]] = { total:0, ecoules:0 };

  var d2 = new Date(year, month, 1);
  while (d2.getMonth() === month) {
    var ouvertes = boutiquesOuvertes(d2);
    for (var oi=0; oi<ouvertes.length; oi++) {
      var pb = parBoutique[ouvertes[oi]];
      if (pb) { pb.total++; if (d2 <= now) pb.ecoules++; }
    }
    d2.setDate(d2.getDate()+1);
  }

  // Reference "groupe" = la boutique la plus ouverte (CHOLET en pratique)
  var max = { total:0, ecoules:0 };
  for (var ci2=0; ci2<codes.length; ci2++) {
    if (parBoutique[codes[ci2]].total > max.total) max = parBoutique[codes[ci2]];
  }
  return { parBoutique: parBoutique, max: max };
}

function pad_(n){ return n<10?'0'+n:String(n); }


// ---- JOURS TRAVAILLES (Objectifs_Indiv) --------------------
// Ancienne version : lisait un onglet 'RAF' absent et retombait EN SILENCE
// sur le total du mois -> colonne M (JoursTravailles) uniformement fausse.
// Les jours reels par vendeur sont maintenus dans Objectifs_Indiv
// (colonnes : Vendeur | ObjMobiles | ObjG3A | ObjCyber | ObjAssu | ObjAccess | JoursTravailles).
// L'echec est desormais BRUYANT : erreur remontee dans le resume de la MAJ.

function getJoursTravailles_() {
  var ss = SpreadsheetApp.openById(SHEET_ID_PRINCIPAL);
  var sh = ss.getSheetByName('Objectifs_Indiv');
  if (!sh) throw new Error("Onglet 'Objectifs_Indiv' introuvable dans le Sheet Principal");
  var lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error("Onglet 'Objectifs_Indiv' vide");
  var data = sh.getRange(2, 1, lastRow-1, 7).getValues();
  var map  = {};
  for (var i=0; i<data.length; i++) {
    var nom   = String(data[i][0]||'').trim().toUpperCase(); // Colonne A : Vendeur (nomSheet 3GWIN)
    var jours = Number(data[i][6]);                          // Colonne G : JoursTravailles
    if (nom && jours > 0) map[nom] = jours;
  }
  if (!Object.keys(map).length) throw new Error("Aucun JoursTravailles lisible dans 'Objectifs_Indiv'");
  return map;
}


// ---- APPEL API POST ----------------------------------------

function postApi_(url, payload) {
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: true
    });
    var json = JSON.parse(resp.getContentText());
    var ok   = json.success === true || json.status === 'ok';
    return { status: ok ? 'OK' : 'HTTP ' + resp.getResponseCode(), rows: json.rows || 0 };
  } catch(e) {
    return { status: 'ERREUR: ' + e.message, rows: 0 };
  }
}


// ---- FETCH PAGE 3GWIN -------------------------------------

function fetchPage_(url) {
  var resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: false
  });
  if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
  return resp.getContentText('UTF-8');
}


// ---- UTILITAIRES ------------------------------------------

function round2_(n) { return Math.round(n*100)/100; }


// ---- CONFIG : "Mois en cours" + "Derniere MAJ" ----
// Garcia Vendeurs dashboard lit Config!A2 pour afficher le mois courant.
// Auparavant la valeur etait figee a "avril 2026" tant que personne ne la
// modifiait manuellement. Ce fix la regenere a chaque MAJ 3GWIN.

function ecrireConfigMois_() {
  var ss = SpreadsheetApp.openById(SHEET_ID_PRINCIPAL);
  var sh = ss.getSheetByName(TAB_CONFIG);
  if (!sh) sh = ss.insertSheet(TAB_CONFIG);
  // Si l onglet est vide on initialise les en-tetes
  if (sh.getLastRow() < 1) {
    sh.getRange('A1:B1').setValues([['Mois en cours','Derniere MAJ']]).setFontWeight('bold');
  }
  var M = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
  var d = new Date();
  var moisLabel = M[d.getMonth()] + ' ' + d.getFullYear();
  sh.getRange('A2').setValue(moisLabel);
  sh.getRange('B2').setValue(Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'));
}


// ---- DONNEES_COMMISSIONS N:O (MobHorsW2S / Box par vendeur) ----
// Le endpoint POST (API1) n'ecrit que les colonnes A:M : N:O restaient
// figees (valeurs d'anciens mois + lignes orphelines). On les reecrit ici
// a chaque MAJ, alignees par nom de vendeur (colonne B), et on vide les
// lignes sans vendeur correspondant.

var TAB_DONNEES_COMM = 'Données_Commissions';

function ecrireColonnesNO_(vendeursList) {
  var ss = SpreadsheetApp.openById(SHEET_ID_PRINCIPAL);
  var sh = ss.getSheetByName(TAB_DONNEES_COMM);
  if (!sh) throw new Error('Onglet ' + TAB_DONNEES_COMM + ' introuvable');

  var map = {};
  for (var i=0; i<vendeursList.length; i++) {
    var v = vendeursList[i];
    map[(v.nom||'').trim().toUpperCase()] = [Math.round(v.mob||0), Math.round(v.box||0)];
  }

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  var noms = sh.getRange(2, 2, lastRow-1, 1).getValues(); // colonne B (Vendeur)
  var out  = [];
  for (var r=0; r<noms.length; r++) {
    var nom = String(noms[r][0]||'').trim().toUpperCase();
    out.push(map[nom] || ['','']);
  }
  sh.getRange(2, 14, out.length, 2).setValues(out); // colonnes N:O
}


// ---- MAGS MOIS DETAIL (agregats 3GWIN par boutique, pour dashboard) ----

function ecrireMagsDetail_(magsData) {
  var ss = SpreadsheetApp.openById(SHEET_ID_PRINCIPAL);
  var sh = ss.getSheetByName(TAB_MAGS_DETAIL);
  if (!sh) sh = ss.insertSheet(TAB_MAGS_DETAIL);

  var headers = [
    'Code','Boutique',
    'Marge','MobHorsW2S','Box','MargeBox','Abo','MargeAbo','BoxMig',
    'Cyber','MargeCyber25',
    'Assu','MargeAssu','G3A','MargeG3A_50',
    'MargeAccess','MargeServices',
    'MargeMobileLigne','MargeMobilePack','MargeParMobile'
  ];
  var rows = [headers];

  for (var i = 0; i < magsData.length; i++) {
    var m = magsData[i];
    var margeG3A     = (m.alba || 0) * 50;
    var margeCyber25 = (m.cyber || 0) * 25; // estimation 25€/cyber
    var margeMobilePack = (m.margeAssu || 0) + margeG3A + (m.access || 0) + (m.margeServices || 0);
    // Marge mobile ligne = residuel apres soustraction des composants connus
    var margeMobileLigne = (m.marge || 0) - (m.margeBox || 0) - (m.margeAbo || 0) - margeMobilePack - margeCyber25;
    var mpMobile   = (m.mob > 0) ? margeMobilePack / m.mob : 0;
    rows.push([
      m.code, m.boutique,
      round2_(m.marge || 0), m.mob || 0, m.box || 0, round2_(m.margeBox || 0), m.abo || 0, round2_(m.margeAbo || 0), m.boxMig || 0,
      m.cyber || 0, margeCyber25,
      m.assu || 0, round2_(m.margeAssu || 0), m.alba || 0, margeG3A,
      round2_(m.access || 0), round2_(m.margeServices || 0),
      round2_(margeMobileLigne), round2_(margeMobilePack), round2_(mpMobile)
    ]);
  }

  sh.clearContents();
  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  if (rows.length > 1) {
    sh.getRange(2, 3, rows.length-1, 18).setNumberFormat('0.##');
  }
}


// ---- FACTURES DETAILLEES MOIS (vraie marge par mobile + modele) ----

function majFacturesMois_() {
  var html = fetchPage_(URL_FACTURES_MOIS);
  // 22/07/2026 : la publication couvre ~30 jours glissants -> ne garder que le mois courant
  var moisCourant = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMM');

  // Parse toutes les lignes factures
  var trMatches = html.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  var lines = [];
  var boostersByBoutique = {};
  var boostersByVendeur  = {};
  for (var t = 0; t < trMatches.length; t++) {
    var cells = [];
    var re = /<p[^>]*>([^<]*)<\/p>/g;
    var m;
    while ((m = re.exec(trMatches[t])) !== null) {
      cells.push(m[1].replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim());
    }
    if (cells.length < 27) continue;
    var entete = cells[6];
    if (entete !== 'FACTURE' && entete !== 'AVOIR') continue;
    if (!cells[4] || !cells[11]) continue;
    if ((cells[1] || '').indexOf(moisCourant) !== 0) continue; // hors mois courant

    var famille = cells[11];
    var codeArt = (cells[9] || '').toUpperCase();
    // Exclure les lignes de regularisation retroactive (boosters Chubb, derembours, etc.)
    if (famille === 'MARGE' || codeArt.indexOf('MARGEASSU') === 0) {
      var boostMarge = parseFloat(String(cells[26]).replace(',','.')) || 0;
      var boostBout  = cells[3] || '';
      var boostVend  = cells[4] || '';
      boostersByBoutique[boostBout] = (boostersByBoutique[boostBout] || 0) + boostMarge;
      boostersByVendeur[boostVend]  = (boostersByVendeur[boostVend]  || 0) + boostMarge;
      continue;
    }

    // 22/07/2026 : cells[47] est un banal "N° Commande" (rempli ~1 vente sur 3),
    // PAS un marqueur W2S (aucun W2S dans cette publication) -> ne plus exclure.
    var isW2S  = false;

    lines.push({
      boutique:    cells[3],
      vendeur:     cells[4],
      entete:      entete,
      numFac:      cells[7],
      codeArticle: cells[9],
      designation: (cells[10] || '').replace(/\s+/g, ' ').substring(0, 60),
      famille:     famille,
      marge:       parseFloat(String(cells[26]).replace(',','.')) || 0,
      abo:         parseFloat(String(cells[27]).replace(',','.')) || 0,
      totalOptions:parseFloat(String(cells[28]).replace(',','.')) || 0,
      margeAddFourn: parseFloat(String(cells[30]).replace(',','.')) || 0,
      meaNat:      parseFloat(String(cells[34]).replace(',','.')) || 0,
      meaReg:      parseFloat(String(cells[35]).replace(',','.')) || 0,
      meaPAF:      parseFloat(String(cells[36]).replace(',','.')) || 0,
      subNu:       parseFloat(String(cells[37]).replace(',','.')) || 0,
      w2s:         isW2S
    });
  }

  // Garde anti-effacement : si le scrape renvoie 0 ligne (vue 3GWIN vide,
  // token expire, panne reseau), on ne reecrit PAS l'onglet : on conserve
  // les donnees precedentes et on remonte une erreur dans le resume.
  if (!lines.length) {
    throw new Error('scrape factures vide (0 ligne) - onglet Factures_Mois conserve');
  }

  // Grouper par facture
  var factures = {};
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (!factures[l.numFac]) {
      factures[l.numFac] = {
        numFac: l.numFac, vendeur: l.vendeur, boutique: l.boutique,
        totalMarge: 0, hasMobile: false, mobiles: []
      };
    }
    var f = factures[l.numFac];
    f.totalMarge += l.marge;
    if (l.famille === 'MOBILE' && !l.w2s) {
      f.hasMobile = true;
      f.mobiles.push({
        codeArticle: l.codeArticle, modele: l.designation, margeMobile: l.marge,
        abo: l.abo, totalOptions: l.totalOptions, margeAddFourn: l.margeAddFourn,
        meaNat: l.meaNat, meaReg: l.meaReg, meaPAF: l.meaPAF, subNu: l.subNu
      });
    }
  }

  // Agregation par vendeur
  var agg = {};
  var mobilesDetail = [];
  var facNums = Object.keys(factures);
  for (var fn = 0; fn < facNums.length; fn++) {
    var fac = factures[facNums[fn]];
    if (!agg[fac.vendeur]) {
      agg[fac.vendeur] = {
        vendeur: fac.vendeur, boutique: fac.boutique,
        nbFactures: 0, totalMarge: 0,
        nbFactMobile: 0, margeFactMobile: 0, nbMobiles: 0
      };
    }
    var v = agg[fac.vendeur];
    v.nbFactures++;
    v.totalMarge += fac.totalMarge;
    if (fac.hasMobile) {
      v.nbFactMobile++;
      v.margeFactMobile += fac.totalMarge;
      v.nbMobiles += fac.mobiles.length;
      var margeFacParMob = fac.totalMarge / fac.mobiles.length;
      for (var mi = 0; mi < fac.mobiles.length; mi++) {
        var mob = fac.mobiles[mi];
        mobilesDetail.push({
          vendeur: fac.vendeur, boutique: fac.boutique,
          numFac: fac.numFac, modele: mob.modele,
          margeMobileSeul: mob.margeMobile,
          margeFactureTotale: fac.totalMarge,
          margeAllouee: margeFacParMob,
          abo: mob.abo,
          optionsMobile: mob.totalOptions,
          remComp: mob.margeAddFourn,
          meaNat: mob.meaNat,
          meaReg: mob.meaReg,
          meaPAF: mob.meaPAF,
          subNu: mob.subNu
        });
      }
    }
  }

  // Ecriture sheet
  var ss = SpreadsheetApp.openById(SHEET_ID_PRINCIPAL);
  var sh = ss.getSheetByName(TAB_FACTURES_MOIS);
  if (!sh) sh = ss.insertSheet(TAB_FACTURES_MOIS);

  var headers = [
    'Type','Vendeur','Boutique','NumFac','Modele',
    'NbFactures','NbFactMobile','NbMobiles',
    'MargeTotale','MargeFactMobile',
    'MargeMobileSeul','MargeFactureTotale','MargeAllouee',
    'MargeParMobile','MargeParFacture',
    'Abo','OptionsMobile','RemComp',
    'MEA_Nat','MEA_Reg','MEA_PAF','SubNu',
    'Date','Heure'
  ];
  var now = new Date();
  var dateStr  = Utilities.formatDate(now, 'Europe/Paris', 'dd/MM/yyyy');
  var heureStr = Utilities.formatDate(now, 'Europe/Paris', 'HH:mm');

  var rows = [headers];
  rows.push(['META','','','','','','','','','','','','','','','','','','','','','', dateStr, heureStr]);

  // SUMMARY par vendeur (trie par marge desc)
  var vendeurList = [];
  var vendeurNoms = Object.keys(agg);
  for (var vn = 0; vn < vendeurNoms.length; vn++) {
    var v = agg[vendeurNoms[vn]];
    var margeParMob = v.nbMobiles > 0 ? round2_(v.margeFactMobile / v.nbMobiles) : 0;
    var margeParFac = v.nbFactures > 0 ? round2_(v.totalMarge / v.nbFactures) : 0;
    vendeurList.push([
      'SUMMARY', v.vendeur, v.boutique, '', '',
      v.nbFactures, v.nbFactMobile, v.nbMobiles,
      round2_(v.totalMarge), round2_(v.margeFactMobile),
      '', '', '',
      margeParMob, margeParFac,
      '','','',
      '','','','',
      '', ''
    ]);
  }
  vendeurList.sort(function(a,b){ return b[8] - a[8]; });
  for (var vl = 0; vl < vendeurList.length; vl++) rows.push(vendeurList[vl]);

  // MOBILE detail (trie par marge facture desc)
  mobilesDetail.sort(function(a,b){ return b.margeFactureTotale - a.margeFactureTotale; });
  for (var md = 0; md < mobilesDetail.length; md++) {
    var m = mobilesDetail[md];
    rows.push([
      'MOBILE', m.vendeur, m.boutique, m.numFac, m.modele,
      '', '', '',
      '', '',
      round2_(m.margeMobileSeul), round2_(m.margeFactureTotale), round2_(m.margeAllouee),
      '', '',
      round2_(m.abo), round2_(m.optionsMobile), round2_(m.remComp),
      round2_(m.meaNat), round2_(m.meaReg), round2_(m.meaPAF), round2_(m.subNu),
      '', ''
    ]);
  }

  sh.clearContents();
  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  if (rows.length > 2) {
    sh.getRange(3, 6, rows.length-2, 17).setNumberFormat('0.##');
  }

  return { nbLignes: lines.length, nbMobiles: mobilesDetail.length,
           boostersByBoutique: boostersByBoutique,
           boostersByVendeur:  boostersByVendeur };
}


// ---- MENU GOOGLE SHEETS -----------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MAJ 3GWIN')
    .addItem('Lancer la mise a jour', 'maj3GWIN')
    .addSeparator()
    .addItem('Configurer declencheur auto (toutes les 2h)', 'configurerTrigger')
    .addItem('Supprimer le declencheur auto', 'supprimerTrigger')
    .addToUi();
}


// ---- DECLENCHEUR AUTOMATIQUE ------------------------------

function configurerTrigger() {
  // Supprimer anciens triggers maj3GWIN
  var triggers = ScriptApp.getProjectTriggers();
  for (var t=0; t<triggers.length; t++) {
    if (triggers[t].getHandlerFunction() === 'maj3GWIN') ScriptApp.deleteTrigger(triggers[t]);
  }
  // Nouveau trigger toutes les 2 heures
  ScriptApp.newTrigger('maj3GWIN').timeBased().everyHours(2).create();
  SpreadsheetApp.getUi().alert('Declencheur cree : MAJ automatique toutes les 2 heures');
}

function supprimerTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var t=0; t<triggers.length; t++) {
    if (triggers[t].getHandlerFunction() === 'maj3GWIN') ScriptApp.deleteTrigger(triggers[t]);
  }
  SpreadsheetApp.getUi().alert('Declencheur supprime');
}
