// Declencheur DILAX - Google Apps Script
// Le planificateur Google (fiable) declenche le workflow GitHub MAJ DILAX via
// workflow_dispatch, toutes les 30 min entre 9h et 20h, du lundi au samedi.
// INSTALLATION : 1) creer un PAT GitHub fine-grained (repo dashboard-groupe-garcia,
// permission Actions Read and write) ; 2) Parametres du projet > Proprietes du script >
// propriete GITHUB_TOKEN = le jeton ; 3) executer installerTriggerDilax() une fois ;
// 4) verifier avec declencherDilaxJour() -> doit logguer HTTP 204 OK.

var GH_OWNER    = 'Dref1969';
var GH_REPO     = 'dashboard-groupe-garcia';
var GH_WORKFLOW = 'maj-dilax.yml';
var GH_REF      = 'main';

function declencherDilaxJour() {
  var tz    = 'Europe/Paris';
  var now   = new Date();
  var jour  = parseInt(Utilities.formatDate(now, tz, 'u'), 10);
  var heure = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  if (jour === 7) { Logger.log('Dimanche - pas de declenchement.'); return; }
  if (heure < 9 || heure >= 20) { Logger.log('Hors fenetre 9h-20h (h=' + heure + ').'); return; }
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) { Logger.log('ERREUR : propriete GITHUB_TOKEN absente (voir INSTALLATION).'); return; }
  var url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/actions/workflows/' + GH_WORKFLOW + '/dispatches';
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
  Logger.log('Dispatch DILAX : HTTP ' + code + (code === 204 ? ' OK' : ' - ' + resp.getContentText()));
}

function installerTriggerDilax() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'declencherDilaxJour') { ScriptApp.deleteTrigger(triggers[i]); }
  }
  ScriptApp.newTrigger('declencherDilaxJour').timeBased().everyMinutes(30).create();
  Logger.log('OK : declencheur declencherDilaxJour cree (toutes les 30 min).');
}

function supprimerTriggerDilax() {
  var triggers = ScriptApp.getProjectTriggers();
  var n = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'declencherDilaxJour') { ScriptApp.deleteTrigger(triggers[i]); n++; }
  }
  Logger.log('Declencheur(s) supprime(s) : ' + n);
}


// === Journal des ventes (popup meilleure vente) : dispatch toutes les 5 min ===
function declencherJournalJour() {
  var tz = 'Europe/Paris';
  var now = new Date();
  var jour = parseInt(Utilities.formatDate(now, tz, 'u'), 10);
  var heure = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  if (jour === 7) return;
  if (heure < 9 || heure >= 20) return;
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) { Logger.log('ERREUR : GITHUB_TOKEN absente.'); return; }
  var url = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/actions/workflows/maj-journal-jour.yml/dispatches';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'GroupeGarcia-AppsScript' },
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
  Logger.log('OK : declencheur declencherJournalJour cree (toutes les 5 min).');
}
