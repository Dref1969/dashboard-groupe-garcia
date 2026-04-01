/**
 * ============================================================
 * GROUPE GARCIA - Synchronisation 3GWIN → Google Sheet
 * ============================================================
 *
 * Ce script récupère automatiquement les données de vente
 * depuis les pages web 3GWIN (3cx.3gwin.net) en temps réel
 * et met à jour le Google Sheet "Données_Commissions" utilisé
 * par la Web App Commissions Projetées.
 *
 * INSTALLATION :
 * 1. Ajouter ce fichier au même projet Google Apps Script
 *    que la Web App Commissions
 * 2. Lancer setupTrigger() une seule fois pour créer le
 *    déclencheur automatique (toutes les heures)
 * 3. Ou lancer sync3GWIN() manuellement pour une MAJ immédiate
 *
 * PRÉ-REQUIS :
 * - Le Google Sheet "Données_Commissions" doit exister avec
 *   les onglets : Données_Commissions, Items_Mois, Config
 * - Les liens 3GWIN doivent être accessibles depuis les
 *   serveurs Google (HTTP, pas de VPN requis)
 * ============================================================
 */

// ===== CONFIGURATION SYNC =====
const SYNC_CONFIG = {
  // ID du Google Sheet cible (même que dans Code.gs)
  idSheet: "1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY", // ID du Google Sheet Données_Commissions
};

// ===== LIENS 3GWIN =====
// Données globales (toutes boutiques)
const LIENS_3GWIN = {
  vendeursMois: "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c40428b5434391e7d18114b587e2388e1ba4",
  magsMois:     "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404d4b037891f8f0385ebf74d7b",

  // Données par boutique (vendeurs dans chaque boutique)
  parBoutique: {
    "CHOLET": "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c40465507d9f65b951bec70748469af0",
    "VLR":    "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404bc7a3e54e47a5aa55283ce",
    "RLR":    "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4046734a8c4171cd64e094cc6",
    "CLR":    "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4040854051b7ec0856f99066a",
    "TLR":    "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c4045206ab8eb111d0a7a07a14",
    "ALR":    "http://3cx.3gwin.net/WD180AWP/WD180Awp.exe/CONNECT/Web3gwin?3G=183b18f2ccc8c404b6a74ec2d2bcc23e5db778"
  }
};

// ===== BOUTIQUES =====
const SYNC_BOUTIQUES = {
  "ALR": "SFR Angers",
  "TLR": "SFR Amboise",
  "CLR": "SFR Châteaudun",
  "CHOLET": "SFR Cholet",
  "RLR": "SFR Romorantin",
  "VLR": "SFR Vendôme"
};

/**
 * ============================================================
 * FONCTION PRINCIPALE — Synchroniser depuis 3GWIN
 * ============================================================
 * Peut être appelée manuellement ou via un trigger automatique.
 *
 * Stratégie : on utilise les liens par boutique (plus précis)
 * pour récupérer les données de chaque vendeur dans sa boutique.
 * On utilise le lien "Vendeurs mois" global comme fallback si
 * un lien boutique échoue, et pour avoir les totaux globaux
 * des vendeurs multi-boutiques.
 */
function sync3GWIN() {
  Logger.log("=== Début synchronisation 3GWIN ===");

  if (!SYNC_CONFIG.idSheet) {
    Logger.log("ERREUR : ID Sheet non configuré dans SYNC_CONFIG.idSheet");
    return;
  }

  try {
    // 1. Récupérer les données par boutique (méthode précise)
    const tousVendeurs = [];
    const boutiquesOK = [];
    const boutiquesKO = [];

    const codesBoutiques = Object.keys(LIENS_3GWIN.parBoutique);

    for (let b = 0; b < codesBoutiques.length; b++) {
      const codeBoutique = codesBoutiques[b];
      const url = LIENS_3GWIN.parBoutique[codeBoutique];

      Logger.log("Récupération " + codeBoutique + "...");

      try {
        const html = fetch3GWIN(url);
        if (html) {
          const vendeurs = parserPage3GWIN(html, codeBoutique);
          Logger.log("  → " + vendeurs.length + " vendeurs trouvés");
          vendeurs.forEach(function(v) { tousVendeurs.push(v); });
          boutiquesOK.push(codeBoutique);
        } else {
          Logger.log("  → Page vide pour " + codeBoutique);
          boutiquesKO.push(codeBoutique);
        }
      } catch (e) {
        Logger.log("  → ERREUR " + codeBoutique + " : " + e.toString());
        boutiquesKO.push(codeBoutique);
      }

      // Pause courte entre les requêtes pour ne pas surcharger le serveur
      Utilities.sleep(1000);
    }

    // 2. Si des boutiques ont échoué, tenter le lien global en fallback
    if (boutiquesKO.length > 0 && tousVendeurs.length === 0) {
      Logger.log("Tous les liens boutiques ont échoué, tentative lien global Vendeurs mois...");
      try {
        const htmlGlobal = fetch3GWIN(LIENS_3GWIN.vendeursMois);
        if (htmlGlobal) {
          const vendeursGlobal = parserPage3GWINGlobal(htmlGlobal);
          Logger.log("Fallback global : " + vendeursGlobal.length + " vendeurs trouvés");
          vendeursGlobal.forEach(function(v) { tousVendeurs.push(v); });
        }
      } catch (e) {
        Logger.log("ERREUR fallback global : " + e.toString());
      }
    }

    if (tousVendeurs.length === 0) {
      Logger.log("ERREUR : Aucune donnée récupérée depuis 3GWIN. Vérifiez que les liens sont accessibles.");
      return;
    }

    // 3. Calculer les jours ouvrés
    const joursOuvres = calculerJoursOuvres();

    // 3bis. Charger les jours travaillés individuels depuis l'onglet RAF
    const rafData = chargerRAF();

    // 4. Écrire dans le Google Sheet (avec colonne M = joursTravailles)
    ecrireDansSheet(tousVendeurs, joursOuvres, rafData);

    // 5. Mettre à jour la date de dernière MAJ dans l'onglet Config
    majConfig();

    Logger.log("=== Synchronisation terminée : " + tousVendeurs.length + " vendeurs, " +
      boutiquesOK.length + " boutiques OK, " + boutiquesKO.length + " en erreur ===");

  } catch (e) {
    Logger.log("ERREUR sync : " + e.toString());
    Logger.log("Stack : " + e.stack);
  }
}

/**
 * ============================================================
 * RÉCUPÉRATION DES PAGES 3GWIN
 * ============================================================
 * Les pages 3GWIN sont en HTTP (pas HTTPS) et servies par
 * WinDev WebDev (rendu côté serveur). UrlFetchApp peut les
 * récupérer directement.
 */
function fetch3GWIN(url) {
  const options = {
    method: "get",
    followRedirects: true,
    muteHttpExceptions: true,
    // Timeout de 30 secondes (les pages 3GWIN peuvent être lentes)
    // Note : Apps Script a un timeout max de 6 minutes par défaut
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code !== 200) {
    Logger.log("HTTP " + code + " pour " + url);
    return null;
  }

  const content = response.getContentText("UTF-8");

  // Vérifier que la page contient bien des données (pas une page d'erreur)
  if (content.length < 500) {
    Logger.log("Page trop courte (" + content.length + " chars) — probablement une erreur");
    return null;
  }

  return content;
}

/**
 * ============================================================
 * PARSING DES PAGES 3GWIN — Par boutique
 * ============================================================
 *
 * Les pages 3GWIN par boutique contiennent un tableau HTML avec :
 * - Première colonne : nom de l'indicateur
 * - Colonnes suivantes : valeurs pour chaque vendeur de cette boutique
 *
 * La première ligne (ou en-tête) contient les noms des vendeurs.
 *
 * Indicateurs clés à extraire :
 * - "Mob TOTAL" / "Mob HW2S" / "MOBILE HORS SERIE" → nb mobiles
 * - "ASSURANCE MOBILE" / "ASS MOBILE" → nb assurances
 * - "CYBERSECURITE" / "CYBER" → nb SFR Cyber
 * - "GARANTIE 3" / "G3A" → nb garanties 3ème année
 * - "ACCESSOIRE" / "CA ACCESS" → CA accessoires
 * - "Marge Brute estimée" / "Marge" → marge (dernière ligne souvent)
 */
function parserPage3GWIN(html, codeBoutique) {
  const vendeurs = [];

  // Extraire le tableau principal
  const tableData = extraireTableauHTML(html);
  if (!tableData || tableData.length < 2) {
    Logger.log("Aucun tableau exploitable dans la page " + codeBoutique);
    return vendeurs;
  }

  // La première ligne contient les noms des vendeurs
  const nomsVendeurs = tableData[0].slice(1);

  // Initialiser les vendeurs
  const vendeursMap = {};
  nomsVendeurs.forEach(function(nom, idx) {
    const nomClean = nom.trim().toUpperCase();
    if (nomClean && nomClean !== "TOTAL" && nomClean !== "GROUPE" && nomClean !== "MAGASIN") {
      vendeursMap[idx] = {
        nom: capitaliserNom(nom.trim()),
        codeBoutique: codeBoutique,
        margeRealisee: 0,
        nbMobiles: 0,
        nbGaranties: 0,
        nbCyber: 0,
        nbAssurances: 0,
        caAccessoires: 0
      };
    }
  });

  // Parcourir les lignes pour extraire les indicateurs
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (row.length < 2) continue;

    const indicateur = row[0].trim().toUpperCase();

    for (let j = 1; j < row.length; j++) {
      const idx = j - 1;
      if (!vendeursMap[idx]) continue;

      const valeur = nettoyerValeur(row[j]);

      if (matchIndicateur(indicateur, ["MOB TOTAL", "MOB HW2S", "MOBILE HORS SERIE", "MOB. TOTAL"])) {
        vendeursMap[idx].nbMobiles = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["ASSURANCE MOBILE", "ASS MOBILE"]) && !matchIndicateur(indicateur, ["CYBER"])) {
        vendeursMap[idx].nbAssurances = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["CYBERSECURITE", "CYBER", "SFR CYBER"])) {
        vendeursMap[idx].nbCyber = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["GARANTIE 3", "G3A", "GARANTIE 3EME", "GARANTIE 3ÈME"])) {
        vendeursMap[idx].nbGaranties = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["ACCESSOIRE", "CA ACCESS", "ACC."])) {
        vendeursMap[idx].caAccessoires = Math.round(valeur * 100) / 100;
      }
      else if (matchIndicateur(indicateur, ["MARGE BRUTE", "MARGE"])) {
        vendeursMap[idx].margeRealisee = Math.round(valeur * 100) / 100;
      }
    }
  }

  // Convertir en tableau
  Object.keys(vendeursMap).forEach(function(idx) {
    vendeurs.push(vendeursMap[idx]);
  });

  return vendeurs;
}

/**
 * ============================================================
 * PARSING DE LA PAGE 3GWIN — Global (Vendeurs mois)
 * ============================================================
 * Utilisé en fallback si les liens par boutique échouent.
 * Ici le vendeur est listé avec ses totaux toutes boutiques
 * confondues. On utilise le Mapping_Vendeurs pour retrouver
 * la boutique principale.
 */
function parserPage3GWINGlobal(html) {
  const vendeurs = [];

  const tableData = extraireTableauHTML(html);
  if (!tableData || tableData.length < 2) {
    Logger.log("Aucun tableau exploitable dans la page Vendeurs mois global");
    return vendeurs;
  }

  // Charger le mapping vendeur → boutique
  const ss = SpreadsheetApp.openById(SYNC_CONFIG.idSheet);
  const mappingBoutique = getVendeurBoutiqueMapping(ss);
  const mappingRole = getVendeurRoleMapping(ss);

  const nomsVendeurs = tableData[0].slice(1);

  const vendeursMap = {};
  nomsVendeurs.forEach(function(nom, idx) {
    const nomClean = nom.trim().toUpperCase();
    if (nomClean && nomClean !== "TOTAL" && nomClean !== "GROUPE" && nomClean !== "MAGASIN") {
      const codeBoutique = mappingBoutique[nomClean] || "ALR";
      vendeursMap[idx] = {
        nom: capitaliserNom(nom.trim()),
        codeBoutique: codeBoutique,
        margeRealisee: 0,
        nbMobiles: 0,
        nbGaranties: 0,
        nbCyber: 0,
        nbAssurances: 0,
        caAccessoires: 0
      };
    }
  });

  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    if (row.length < 2) continue;

    const indicateur = row[0].trim().toUpperCase();

    for (let j = 1; j < row.length; j++) {
      const idx = j - 1;
      if (!vendeursMap[idx]) continue;

      const valeur = nettoyerValeur(row[j]);

      if (matchIndicateur(indicateur, ["MOB TOTAL", "MOB HW2S", "MOBILE HORS SERIE", "MOB. TOTAL"])) {
        vendeursMap[idx].nbMobiles = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["ASSURANCE MOBILE", "ASS MOBILE"]) && !matchIndicateur(indicateur, ["CYBER"])) {
        vendeursMap[idx].nbAssurances = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["CYBERSECURITE", "CYBER", "SFR CYBER"])) {
        vendeursMap[idx].nbCyber = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["GARANTIE 3", "G3A", "GARANTIE 3EME", "GARANTIE 3ÈME"])) {
        vendeursMap[idx].nbGaranties = Math.round(valeur);
      }
      else if (matchIndicateur(indicateur, ["ACCESSOIRE", "CA ACCESS", "ACC."])) {
        vendeursMap[idx].caAccessoires = Math.round(valeur * 100) / 100;
      }
      else if (matchIndicateur(indicateur, ["MARGE BRUTE", "MARGE"])) {
        vendeursMap[idx].margeRealisee = Math.round(valeur * 100) / 100;
      }
    }
  }

  Object.keys(vendeursMap).forEach(function(idx) {
    vendeurs.push(vendeursMap[idx]);
  });

  return vendeurs;
}

/**
 * ============================================================
 * EXTRACTION DE TABLEAU HTML
 * ============================================================
 * Les pages 3GWIN (WinDev WebDev) génèrent du HTML côté serveur
 * avec des tableaux <table>. On parse les <tr>/<td> pour
 * reconstituer un tableau 2D.
 */
function extraireTableauHTML(html) {
  // Chercher tous les tableaux et prendre le plus grand
  // (les pages 3GWIN peuvent avoir des tableaux de mise en page)
  const allTables = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!allTables || allTables.length === 0) return null;

  let bestTable = null;
  let bestRowCount = 0;

  allTables.forEach(function(tableHtml) {
    const parsed = parseTableHTML(tableHtml);
    if (parsed.length > bestRowCount) {
      bestRowCount = parsed.length;
      bestTable = parsed;
    }
  });

  return bestTable;
}

function parseTableHTML(tableHtml) {
  const rows = [];
  const trMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!trMatches) return rows;

  trMatches.forEach(function(tr) {
    const cells = [];
    const tdMatches = tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (tdMatches) {
      tdMatches.forEach(function(td) {
        // Extraire le texte en enlevant les balises HTML
        const text = td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
        cells.push(text);
      });
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  return rows;
}

/**
 * ============================================================
 * CHARGEMENT DES JOURS TRAVAILLÉS (RAF)
 * ============================================================
 * Lit l'onglet "RAF" du Google Sheet pour récupérer les jours
 * travaillés individuels de chaque vendeur dans le mois.
 *
 * Structure attendue de l'onglet RAF :
 *   Colonne A : Nom vendeur (MAJUSCULES)
 *   Colonne B : Jours travaillés ce mois
 *
 * Si l'onglet n'existe pas, retourne un objet vide (tous les
 * vendeurs auront nbJoursOuvres par défaut).
 */
function chargerRAF() {
  const ss = SpreadsheetApp.openById(SYNC_CONFIG.idSheet);
  const rafSheet = ss.getSheetByName("RAF");

  if (!rafSheet) {
    Logger.log("Onglet RAF non trouvé — les jours travaillés seront = jours ouvrés du mois");
    return {};
  }

  const data = rafSheet.getDataRange().getValues();
  const raf = {};

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      const nom = data[i][0].toString().toUpperCase().trim();
      const jours = parseInt(data[i][1]) || 0;
      if (jours > 0) {
        raf[nom] = jours;
      }
    }
  }

  Logger.log("RAF chargé : " + Object.keys(raf).length + " vendeurs avec jours travaillés individuels");
  return raf;
}

/**
 * ============================================================
 * ÉCRITURE DANS LE GOOGLE SHEET
 * ============================================================
 */
function ecrireDansSheet(tousVendeurs, joursOuvres, rafData) {
  const ss = SpreadsheetApp.openById(SYNC_CONFIG.idSheet);
  const sheet = ss.getSheetByName("Données_Commissions");

  if (!sheet) {
    Logger.log("ERREUR : Onglet 'Données_Commissions' non trouvé !");
    return;
  }

  // Charger le mapping rôle depuis Mapping_Vendeurs
  const mappingRole = getVendeurRoleMapping(ss);

  // Effacer les anciennes données (garder la ligne d'en-tête)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Écrire les nouvelles données
  tousVendeurs.forEach(function(vendeur, index) {
    const row = index + 2; // Commence à la ligne 2

    // Déterminer le rôle depuis le mapping (Vendeur par défaut)
    const role = mappingRole[vendeur.nom.toUpperCase()] || "Vendeur";

    // Nb mobiles pour le taux d'assurance (même que nbMobiles)
    const nbMobilesAssurance = vendeur.nbMobiles;

    sheet.getRange(row, 1).setValue(vendeur.codeBoutique);             // A: Code boutique
    sheet.getRange(row, 2).setValue(vendeur.nom);                      // B: Nom collaborateur
    sheet.getRange(row, 3).setValue(role);                              // C: Rôle
    sheet.getRange(row, 4).setValue(vendeur.margeRealisee);            // D: Marge réalisée
    sheet.getRange(row, 5).setValue(vendeur.nbMobiles);                // E: Nb mobiles
    sheet.getRange(row, 6).setValue(vendeur.nbGaranties);              // F: Nb garanties 3ème année
    sheet.getRange(row, 7).setValue(vendeur.nbCyber);                  // G: Nb cyber
    sheet.getRange(row, 8).setValue(vendeur.nbAssurances);             // H: Nb assurances
    sheet.getRange(row, 9).setValue(nbMobilesAssurance);               // I: Nb mobiles (taux assurance)
    sheet.getRange(row, 10).setValue(vendeur.caAccessoires);           // J: CA accessoires
    sheet.getRange(row, 11).setValue(joursOuvres.joursEcoules);        // K: Jour ouvré courant
    sheet.getRange(row, 12).setValue(joursOuvres.joursTotal);          // L: Nb jours ouvrés total

    // M: Jours travaillés individuels (depuis onglet RAF, sinon = total jours ouvrés)
    const nomUpper = vendeur.nom.toUpperCase().trim();
    const joursTravailles = (rafData && rafData[nomUpper]) ? rafData[nomUpper] : joursOuvres.joursTotal;
    sheet.getRange(row, 13).setValue(joursTravailles);                 // M: Jours travaillés
  });

  Logger.log("Sheet mis à jour : " + tousVendeurs.length + " vendeurs (avec jours travaillés)");
}

/**
 * ============================================================
 * MAPPING VENDEURS
 * ============================================================
 * Lire le mapping vendeur → boutique et vendeur → rôle
 * depuis l'onglet "Mapping_Vendeurs".
 * Si l'onglet n'existe pas, le créer avec des valeurs par défaut.
 */
function getVendeurBoutiqueMapping(ss) {
  const mappingSheet = getOrCreateMappingSheet(ss);
  const data = mappingSheet.getDataRange().getValues();
  const mapping = {};

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      mapping[data[i][0].toString().toUpperCase().trim()] = data[i][1].toString().trim();
    }
  }

  return mapping;
}

function getVendeurRoleMapping(ss) {
  const mappingSheet = getOrCreateMappingSheet(ss);
  const data = mappingSheet.getDataRange().getValues();
  const mapping = {};

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][2]) {
      mapping[data[i][0].toString().toUpperCase().trim()] = data[i][2].toString().trim();
    }
  }

  return mapping;
}

function getOrCreateMappingSheet(ss) {
  let mappingSheet = ss.getSheetByName("Mapping_Vendeurs");

  if (!mappingSheet) {
    mappingSheet = ss.insertSheet("Mapping_Vendeurs");
    mappingSheet.appendRow(["Nom Vendeur (MAJUSCULES)", "Code Boutique", "Rôle"]);

    // Mapping par défaut basé sur les données connues du Groupe Garcia
    const defaults = [
      ["HASSENE", "TLR", "Vendeur"],
      ["JULIE TLR", "TLR", "Vendeur"],
      ["AXEL", "ALR", "Vendeur"],
      ["PAULINE", "ALR", "Vendeur"],
      ["RACHEL", "CLR", "Vendeur"],
      ["ILIAN", "CLR", "Vendeur"],
      ["ANAIS", "CHOLET", "Vendeur"],
      ["LUCAS", "CHOLET", "Vendeur"],
      ["LOUANE", "CHOLET", "Vendeur"],
      ["EMMY", "CHOLET", "Vendeur"],
      ["CHLOE R", "CHOLET", "Vendeur"],
      ["WILL", "RLR", "Vendeur"],
      ["EMILIE", "RLR", "Vendeur"],
      ["NATHAN", "RLR", "Vendeur"],
      ["MEHDY", "VLR", "Vendeur"],
      ["ROMAIN GP", "VLR", "RPV"]
    ];

    defaults.forEach(function(row) {
      mappingSheet.appendRow(row);
    });

    mappingSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#e60000").setFontColor("white");
    mappingSheet.autoResizeColumns(1, 3);

    Logger.log("Onglet Mapping_Vendeurs créé avec les valeurs par défaut");
  }

  return mappingSheet;
}

/**
 * Mettre à jour l'onglet Config avec la date de dernière MAJ
 */
function majConfig() {
  const ss = SpreadsheetApp.openById(SYNC_CONFIG.idSheet);
  let configSheet = ss.getSheetByName("Config");

  if (!configSheet) {
    configSheet = ss.insertSheet("Config");
    configSheet.appendRow(["Mois en cours", "Dernière MAJ"]);
    configSheet.appendRow(["", ""]);
    configSheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#e60000").setFontColor("white");
  }

  const now = new Date();
  const mois = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const moisCapitalized = mois.charAt(0).toUpperCase() + mois.slice(1);

  configSheet.getRange(2, 1).setValue(moisCapitalized);
  configSheet.getRange(2, 2).setValue(now.toLocaleString('fr-FR'));

  Logger.log("Config mise à jour : " + moisCapitalized + " — " + now.toLocaleString('fr-FR'));
}

/**
 * ============================================================
 * CALCUL DES JOURS OUVRÉS
 * ============================================================
 */
function calculerJoursOuvres() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const joursFeries = getJoursFeries(year);

  let joursTotal = 0;
  let joursEcoules = 0;
  const dernierJour = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= dernierJour; d++) {
    const date = new Date(year, month, d);
    const jour = date.getDay(); // 0=dimanche, 6=samedi

    if (jour === 0 || jour === 6) continue;

    const dateStr = date.toISOString().split('T')[0];
    if (joursFeries.indexOf(dateStr) >= 0) continue;

    joursTotal++;
    if (d <= now.getDate()) {
      joursEcoules++;
    }
  }

  joursEcoules = Math.max(joursEcoules, 1);

  Logger.log("Jours ouvrés : " + joursEcoules + " / " + joursTotal);
  return { joursEcoules: joursEcoules, joursTotal: joursTotal };
}

/**
 * Jours fériés français pour une année donnée
 */
function getJoursFeries(year) {
  const feries = [
    year + '-01-01',
    year + '-05-01',
    year + '-05-08',
    year + '-07-14',
    year + '-08-15',
    year + '-11-01',
    year + '-11-11',
    year + '-12-25',
  ];

  // Pâques (algorithme de Meeus/Jones/Butcher)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const moisPaques = Math.floor((h + l - 7 * m + 114) / 31);
  const jourPaques = ((h + l - 7 * m + 114) % 31) + 1;

  const paques = new Date(year, moisPaques - 1, jourPaques);

  const lundiPaques = new Date(paques);
  lundiPaques.setDate(lundiPaques.getDate() + 1);
  feries.push(lundiPaques.toISOString().split('T')[0]);

  const ascension = new Date(paques);
  ascension.setDate(ascension.getDate() + 39);
  feries.push(ascension.toISOString().split('T')[0]);

  const pentecote = new Date(paques);
  pentecote.setDate(pentecote.getDate() + 50);
  feries.push(pentecote.toISOString().split('T')[0]);

  return feries;
}

/**
 * ============================================================
 * UTILITAIRES
 * ============================================================
 */

/**
 * Nettoie une valeur texte en nombre
 * Gère les espaces dans les grands nombres, les virgules françaises, etc.
 */
function nettoyerValeur(texte) {
  if (!texte) return 0;
  // Enlever espaces (y compris insécables), remplacer virgule par point
  const clean = texte.toString().replace(/[\s\u00A0]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

/**
 * Vérifie si un indicateur correspond à l'un des patterns
 */
function matchIndicateur(indicateur, patterns) {
  for (let i = 0; i < patterns.length; i++) {
    if (indicateur.indexOf(patterns[i]) >= 0) return true;
  }
  return false;
}

/**
 * Capitalise un nom : "JEAN DUPONT" → "Jean Dupont"
 */
function capitaliserNom(nom) {
  return nom.split(' ').map(function(word) {
    if (word.length === 0) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * ============================================================
 * SETUP DU TRIGGER AUTOMATIQUE
 * ============================================================
 * Lancer cette fonction UNE SEULE FOIS pour installer le
 * déclencheur automatique (toutes les heures).
 */
function setupTrigger() {
  // Supprimer les anciens triggers de ce type
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'sync3GWIN') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('sync3GWIN')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("Trigger installé : sync3GWIN() s'exécutera toutes les heures");
}

/**
 * Supprimer le trigger automatique
 */
function removeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'sync3GWIN') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  Logger.log("Triggers supprimés : " + removed);
}

/**
 * ============================================================
 * TEST — Lancer manuellement pour vérifier la récupération
 * ============================================================
 */
function testFetch() {
  Logger.log("=== Test récupération 3GWIN ===");

  // Tester le lien Vendeurs mois global
  Logger.log("Test lien Vendeurs mois...");
  try {
    const html = fetch3GWIN(LIENS_3GWIN.vendeursMois);
    if (html) {
      Logger.log("OK — " + html.length + " caractères récupérés");
      const table = extraireTableauHTML(html);
      if (table) {
        Logger.log("Tableau trouvé : " + table.length + " lignes, " + table[0].length + " colonnes");
        Logger.log("En-têtes : " + table[0].join(" | "));
      } else {
        Logger.log("ATTENTION : Aucun tableau trouvé dans la page");
      }
    } else {
      Logger.log("ÉCHEC — Page vide ou inaccessible");
    }
  } catch (e) {
    Logger.log("ERREUR : " + e.toString());
  }

  // Tester un lien boutique
  Logger.log("\nTest lien boutique ALR...");
  try {
    const html = fetch3GWIN(LIENS_3GWIN.parBoutique["ALR"]);
    if (html) {
      Logger.log("OK — " + html.length + " caractères récupérés");
      const vendeurs = parserPage3GWIN(html, "ALR");
      vendeurs.forEach(function(v) {
        Logger.log("  " + v.nom + " — Marge: " + v.margeRealisee + "€ | Mob: " + v.nbMobiles +
          " | G3A: " + v.nbGaranties + " | Cyber: " + v.nbCyber +
          " | Assu: " + v.nbAssurances + " | Access: " + v.caAccessoires + "€");
      });
    } else {
      Logger.log("ÉCHEC — Page vide ou inaccessible");
    }
  } catch (e) {
    Logger.log("ERREUR : " + e.toString());
  }
}
