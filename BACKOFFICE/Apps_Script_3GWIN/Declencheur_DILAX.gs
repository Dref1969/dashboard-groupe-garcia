// ============================================================
// Déclencheur DILAX — Google Apps Script
// ============================================================
// Pourquoi : le scheduler planifié de GitHub (gratuit, repo public) abandonne
// régulièrement les démarrages des workflows, surtout le matin → l'onglet
// DILAX_Jour restait vide et le Dashboard Jour affichait 0 visiteurs.
//
// Solution : le planificateur Google Apps Script (fiable — il pilote déjà la MAJ
// 3GWIN toutes les 5 min) déclenche le workflow GitHub "MAJ DILAX" via l'API
// workflow_dispatch, toutes les 30 min entre 9h et 20h, du lundi au samedi.
// Le workflow scrape DILAX (Playwright, impossible en Apps Script) puis POST les
// visiteurs vers le Sheet.
//
// INSTALLATION (une seule fois) :
//   1. Créer un jeton GitHub fine-grained (PAT) :
//      GitHub > Settings > Developer settings > Personal access tokens >
//      Fine-grained tokens > Generate new token
//        - Repository access : Only select repositories > dashboard-groupe-garcia
//        - Permissions > Repository permissions > Actions : Read and write
//        - Expiration : 1 an (ou No expiration)
//      Copier le jeton (commence par github_pat_...).
//   2. Le coller dans les propriétés du script (le jeton n'apparaît jamais dans le code) :
//      Apps Script > ⚙ Paramètres du projet > Propriétés du script > Ajouter
//        - Propriété : GITHUB_TOKEN
//        - Valeur    : (coller le jeton)
//   3. Exécuter UNE FOIS la fonction installerTriggerDilax() (menu Exécuter).
//   4. Vérifier avec declencherDilaxJour() (doit logguer "HTTP 204 OK").
// ============================================================

var GH_OWNER    = 'Dref1969';
var GH_REPO     = 'dashboard-groupe-garcia';
var GH_WORKFLOW = 'maj-dilax.yml';
var GH_REF      = 'main';

// Appelée par le déclencheur temporel toutes les 30 min.
// Ne déclenche le workflow que dans la fenêtre lun-sam 9h-20h (Europe/Paris).
function declencherDilaxJour() {
  var tz    = 'Europe/Paris';
  var now   = new Date();
  var jour  = parseInt(Utilities.formatDate(now, tz, 'u'), 10); // 1=lundi … 7=dimanche
  var heure = parseInt(Utilities.formatDate(now, tz, 'H'), 10);

  if (jour === 7) { Logger.log('Dimanche — pas de déclenchement.'); return; }
  if (heure < 9 || heure >= 20) { Logger.log('Hors fenêtre 9h-20h (h=' + heure + ').'); return; }

  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) { Logger.log('ERREUR : propriété GITHUB_TOKEN absente (voir INSTALLATION).'); return; }

  var url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO +
            '/actions/workflows/' + GH_WORKFLOW + '/dispatches';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'GroupeGarcia-AppsScript'
    },
    payload: JSON.stringify({ ref: GH_REF }),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  // 204 = succès (GitHub a accepté le déclenchement).
  Logger.log('Dispatch DILAX : HTTP ' + code + (code === 204 ? ' OK' : ' — ' + resp.getContentText()));
}

// À exécuter UNE FOIS pour créer le déclencheur temporel (toutes les 30 min).
// La fenêtre 9h-20h lun-sam est gérée dans declencherDilaxJour().
function installerTriggerDilax() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'declencherDilaxJour') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('declencherDilaxJour').timeBased().everyMinutes(30).create();
  Logger.log('OK : déclencheur declencherDilaxJour créé (toutes les 30 min).');
}

function supprimerTriggerDilax() {
  var triggers = ScriptApp.getProjectTriggers();
  var n = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'declencherDilaxJour') {
      ScriptApp.deleteTrigger(triggers[i]); n++;
    }
  }
  Logger.log('Déclencheur(s) supprimé(s) : ' + n);
}


// ============================================================
// Journal des ventes (pop-up meilleure vente) : dispatch TOUTES LES 5 MIN
// Réutilise GITHUB_TOKEN + GH_OWNER/GH_REPO/GH_REF ci-dessus.
// Trigger installé via l'UI "Ajouter un déclencheur" (Intervalle en minutes →
// Toutes les 5 minutes) car le bouton Exécuter de l'éditeur lance parfois la
// mauvaise fonction. installerTriggerJournal() fonctionne aussi si exécuté seul.
// ============================================================
function declencherJournalJour() {
  var tz = 'Europe/Paris';
  var now = new Date();
  var jour = parseInt(Utilities.formatDate(now, tz, 'u'), 10);   // 1=lundi … 7=dimanche
  var heure = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  if (jour === 7) return;
  if (heure < 9 || heure >= 20) return;
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) { Logger.log('ERREUR : GITHUB_TOKEN absente.'); return; }
  var url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO +
            '/actions/workflows/maj-journal-jour.yml/dispatches';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'GroupeGarcia-AppsScript' },
    payload: JSON.stringify({ ref: GH_REF }), muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  Logger.log('Dispatch Journal : HTTP ' + code + (code === 204 ? ' OK' : ' - ' + resp.getContentText()));
}

function installerTriggerJournal() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'declencherJournalJour') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('declencherJournalJour').timeBased().everyMinutes(5).create();
  Logger.log('OK : déclencheur declencherJournalJour créé (toutes les 5 min).');
}
