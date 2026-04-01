/**
 * ============================================================
 * GROUPE GARCIA - Commissions Projetées
 * Backend Google Apps Script
 * ============================================================
 *
 * Web App permettant aux collaborateurs de consulter
 * leur projection de commission mensuelle en temps réel.
 *
 * INSTALLATION : voir GUIDE_DEPLOIEMENT.md
 * ============================================================
 */

// ===== CONFIGURATION =====
const CONFIG = {
  idSheet: "1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY", // ID du Google Sheet "Données_Commissions"
  nomEntreprise: "Groupe Garcia",
  moisEnCours: "Avril 2026"
};

// ===== BOUTIQUES =====
const BOUTIQUES = {
  "ALR": "SFR Angers",
  "TLR": "SFR Amboise",
  "CLR": "SFR Châteaudun",
  "CHOLET": "SFR Cholet",
  "RLR": "SFR Romorantin",
  "VLR": "SFR Vendôme"
};

// ===== BARÈME VENDEUR — PALIERS DE MARGE =====
const PALIERS_VENDEUR = [
  { min: 0,    max: 2000,  pct: 0 },
  { min: 2000, max: 3000,  pct: 0.02 },
  { min: 3000, max: 4000,  pct: 0.03 },
  { min: 4000, max: 5000,  pct: 0.05 },
  { min: 5000, max: 6000,  pct: 0.06 },
  { min: 6000, max: 7000,  pct: 0.07 },
  { min: 7000, max: 8000,  pct: 0.08 },
  { min: 8000, max: 9000,  pct: 0.09 },
  { min: 9000, max: Infinity, pct: 0.10 }
];

// ===== BARÈME RPV CHOLET — PALIERS DE MARGE MAGASIN =====
const PALIERS_RPV = [
  { min: 0,     max: 18000, pct: 0 },
  { min: 18000, max: 20000, pct: 0.01 },
  { min: 20000, max: 22000, pct: 0.012 },
  { min: 22000, max: 23000, pct: 0.024 },
  { min: 23000, max: 24000, pct: 0.026 },
  { min: 24000, max: 26000, pct: 0.028 },
  { min: 26000, max: Infinity, pct: 0.03 }
];

// ===== DONNÉES DE DÉMO =====
// Utilisées si CONFIG.idSheet est vide (mode test)
const DEMO_COLLABORATEURS = [
  { codeBoutique: "ALR", nom: "Jean Dupont", role: "Vendeur" },
  { codeBoutique: "ALR", nom: "Marie Martin", role: "Vendeur" },
  { codeBoutique: "TLR", nom: "Pierre Lefevre", role: "Vendeur" },
  { codeBoutique: "CHOLET", nom: "Sophie Bernard", role: "RPV" },
  { codeBoutique: "CLR", nom: "Thomas Richard", role: "Vendeur" }
];

const DEMO_ITEMS = [
  { nom: "Mobiles", objectif: 20, unite: "unités", poids: "20%" },
  { nom: "Garantie 3ème Année", objectif: 50, unite: "%", poids: "20%" },
  { nom: "SFR Cyber", objectif: 15, unite: "unités", poids: "20%" },
  { nom: "Taux d'Assurance", objectif: 40, unite: "%", poids: "20%" },
  { nom: "Taux d'Accessoire", objectif: 30, unite: "€/vente", poids: "20%" }
];

/**
 * Point d'entrée — sert la page HTML
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Commissions')
    .setTitle('Mes Commissions - Groupe Garcia')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Renvoie la liste des collaborateurs pour le menu déroulant
 * Appelé depuis le HTML via google.script.run
 */
function getCollaborateurs() {
  // Mode démo si l'ID Sheet n'est pas configuré
  if (!CONFIG.idSheet) {
    return DEMO_COLLABORATEURS.map(c => ({
      nom: c.nom,
      codeBoutique: c.codeBoutique,
      boutique: BOUTIQUES[c.codeBoutique] || c.codeBoutique
    }));
  }

  try {
    const sheet = SpreadsheetApp.openById(CONFIG.idSheet).getSheetByName("Données_Commissions");
    const data = sheet.getDataRange().getValues();
    const collabs = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) { // Vérifier que la ligne n'est pas vide
        collabs.push({
          nom: data[i][1],        // Colonne B
          codeBoutique: data[i][0], // Colonne A
          boutique: BOUTIQUES[data[i][0]] || data[i][0]
        });
      }
    }

    return collabs;
  } catch (e) {
    Logger.log("Erreur lecture collaborateurs : " + e.toString());
    return DEMO_COLLABORATEURS.map(c => ({
      nom: c.nom,
      codeBoutique: c.codeBoutique,
      boutique: BOUTIQUES[c.codeBoutique] || c.codeBoutique
    }));
  }
}

// ===== CODES D'AUTHENTIFICATION PAR DÉFAUT =====
const CODES_VENDEURS_DEFAUT = {
  "HASSENE":   "HASSENE1847",
  "JULIE TLR": "JULIE3291",
  "AXEL":      "AXEL8903",
  "PAULINE":   "PAULINE5274",
  "RACHEL":    "RACHEL6138",
  "ILIAN":     "ILIAN4562",
  "ANAIS":     "ANAIS4721",
  "LUCAS":     "LUCAS7395",
  "LOUANE":    "LOUANE2648",
  "EMMY":      "EMMY9173",
  "CHLOE R":   "CHLOE8426",
  "WILL":      "WILL3857",
  "EMILIE":    "EMILIE6924",
  "NATHAN":    "NATHAN1583",
  "MEHDY":     "MEHDY7246",
  "ROMAIN GP": "ROMAIN5831"
};

/**
 * Vérifie le code d'authentification d'un vendeur
 * Retourne le nom du vendeur si le code est valide, sinon une erreur
 * Le code est vérifié dans la colonne "Code" de l'onglet Mapping_Vendeurs
 */
function verifierCode(codeEntre) {
  if (!codeEntre || codeEntre.trim() === "") {
    return { success: false, message: "Veuillez saisir votre code personnel" };
  }

  const codeSaisi = codeEntre.trim().toUpperCase();

  try {
    const ss = SpreadsheetApp.openById(CONFIG.idSheet);
    const mappingSheet = ss.getSheetByName("Mapping_Vendeurs");

    if (mappingSheet) {
      const data = mappingSheet.getDataRange().getValues();
      // Chercher la colonne "Code" dans les en-têtes
      const headers = data[0];
      let codeColIndex = -1;
      for (let c = 0; c < headers.length; c++) {
        if (headers[c].toString().toUpperCase().indexOf("CODE") >= 0) {
          codeColIndex = c;
          break;
        }
      }

      if (codeColIndex >= 0) {
        for (let i = 1; i < data.length; i++) {
          const codeSheet = data[i][codeColIndex] ? data[i][codeColIndex].toString().toUpperCase().trim() : "";
          if (codeSheet === codeSaisi) {
            // Code trouvé — retrouver le nom du vendeur dans Données_Commissions
            const nomMapping = data[i][0] ? data[i][0].toString().trim() : "";
            // Chercher le nom complet dans Données_Commissions
            const nomComplet = trouverNomCompletParMapping(ss, nomMapping);
            if (nomComplet) {
              return { success: true, nom: nomComplet };
            } else {
              return { success: true, nom: capitaliserNomAuth(nomMapping) };
            }
          }
        }
      }
    }

    // Fallback : vérifier dans les codes par défaut
    const nomsVendeurs = Object.keys(CODES_VENDEURS_DEFAUT);
    for (let i = 0; i < nomsVendeurs.length; i++) {
      if (CODES_VENDEURS_DEFAUT[nomsVendeurs[i]].toUpperCase() === codeSaisi) {
        const nomComplet = trouverNomCompletParMapping(
          SpreadsheetApp.openById(CONFIG.idSheet),
          nomsVendeurs[i]
        );
        return { success: true, nom: nomComplet || capitaliserNomAuth(nomsVendeurs[i]) };
      }
    }

    return { success: false, message: "Code invalide. Vérifiez votre code personnel." };

  } catch (e) {
    Logger.log("Erreur vérification code : " + e.toString());
    // Fallback sur les codes par défaut en cas d'erreur
    const nomsVendeurs = Object.keys(CODES_VENDEURS_DEFAUT);
    for (let i = 0; i < nomsVendeurs.length; i++) {
      if (CODES_VENDEURS_DEFAUT[nomsVendeurs[i]].toUpperCase() === codeSaisi) {
        return { success: true, nom: capitaliserNomAuth(nomsVendeurs[i]) };
      }
    }
    return { success: false, message: "Erreur de connexion. Réessayez." };
  }
}

/**
 * Retrouve le nom complet d'un vendeur dans Données_Commissions
 * à partir de son nom dans Mapping_Vendeurs
 */
function trouverNomCompletParMapping(ss, nomMapping) {
  try {
    const sheet = ss.getSheetByName("Données_Commissions");
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const nomUpper = nomMapping.toUpperCase().trim();

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toString().toUpperCase().trim().indexOf(nomUpper) >= 0) {
        return data[i][1].toString().trim();
      }
    }
    // Essayer aussi avec le prénom seul
    const prenom = nomUpper.split(' ')[0];
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] && data[i][1].toString().toUpperCase().trim().indexOf(prenom) >= 0) {
        return data[i][1].toString().trim();
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function capitaliserNomAuth(nom) {
  return nom.split(' ').map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Initialise les codes vendeurs dans l'onglet Mapping_Vendeurs
 * À lancer UNE SEULE FOIS pour créer la colonne "Code"
 */
function setupCodesVendeurs() {
  const ss = SpreadsheetApp.openById(CONFIG.idSheet);
  let mappingSheet = ss.getSheetByName("Mapping_Vendeurs");

  if (!mappingSheet) {
    Logger.log("Onglet Mapping_Vendeurs non trouvé, il sera créé au prochain sync");
    return;
  }

  const data = mappingSheet.getDataRange().getValues();
  const headers = data[0];

  // Vérifier si la colonne Code existe déjà
  let codeColIndex = -1;
  for (let c = 0; c < headers.length; c++) {
    if (headers[c].toString().toUpperCase().indexOf("CODE") >= 0) {
      codeColIndex = c;
      break;
    }
  }

  if (codeColIndex < 0) {
    // Ajouter la colonne Code (colonne D = index 3)
    codeColIndex = headers.length;
    mappingSheet.getRange(1, codeColIndex + 1).setValue("Code").setFontWeight("bold").setBackground("#e60000").setFontColor("white");
  }

  // Remplir les codes par défaut
  for (let i = 1; i < data.length; i++) {
    const nomVendeur = data[i][0] ? data[i][0].toString().toUpperCase().trim() : "";
    if (nomVendeur && CODES_VENDEURS_DEFAUT[nomVendeur]) {
      mappingSheet.getRange(i + 1, codeColIndex + 1).setValue(CODES_VENDEURS_DEFAUT[nomVendeur]);
    }
  }

  Logger.log("Codes vendeurs initialisés dans Mapping_Vendeurs (colonne " + (codeColIndex + 1) + ")");
}

/**
 * Calcule et renvoie toutes les données de commission pour un collaborateur
 * C'est la fonction principale de l'application
 */
function getCommissionsData(nomCollab) {
  // Mode démo si l'ID Sheet n'est pas configuré
  if (!CONFIG.idSheet) {
    return getCommissionsDataDemo(nomCollab);
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.idSheet);
    const sheetDonnees = ss.getSheetByName("Données_Commissions");
    const data = sheetDonnees.getDataRange().getValues();

    let collab = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === nomCollab) {
        collab = {
          codeBoutique: data[i][0],
          nom: data[i][1],
          role: data[i][2],
          margeRealisee: data[i][3] || 0,
          nbMobiles: data[i][4] || 0,
          nbGaranties: data[i][5] || 0,
          nbCyber: data[i][6] || 0,
          nbAssurances: data[i][7] || 0,
          nbMobilesAssurance: data[i][8] || 0,
          caAccessoires: data[i][9] || 0,
          jourOuvre: data[i][10] || 1,
          nbJoursOuvres: data[i][11] || 22,
          joursTravailles: data[i][12] || data[i][11] || 22
        };
        break;
      }
    }

    if (!collab) return { error: "Collaborateur non trouvé" };

    // Lire les items du mois
    const sheetItems = ss.getSheetByName("Items_Mois");
    const itemsData = sheetItems.getDataRange().getValues();
    const items = [];
    for (let i = 1; i < itemsData.length; i++) {
      if (itemsData[i][0]) {
        items.push({
          nom: itemsData[i][0],
          objectif: itemsData[i][1] || 0,
          unite: itemsData[i][2] || "",
          poids: itemsData[i][3] || "20%"
        });
      }
    }

    // Lire la config
    const sheetConfig = ss.getSheetByName("Config");
    const configData = sheetConfig.getDataRange().getValues();
    const moisEnCours = configData[1][0] || CONFIG.moisEnCours;
    const derniereMaj = configData[1][1] || new Date().toLocaleString('fr-FR');

    return calculerCommissions(collab, items, moisEnCours, derniereMaj);

  } catch (e) {
    Logger.log("Erreur calcul commissions : " + e.toString());
    return getCommissionsDataDemo(nomCollab);
  }
}

/**
 * Mode démo — renvoie des données fictives réalistes
 */
function getCommissionsDataDemo(nomCollab) {
  // Chercher le collaborateur dans les données de démo
  let collabDemo = DEMO_COLLABORATEURS.find(c => c.nom === nomCollab);
  if (!collabDemo) {
    collabDemo = DEMO_COLLABORATEURS[0];
  }

  // Générer des données réalistes
  let collab = {
    codeBoutique: collabDemo.codeBoutique,
    nom: collabDemo.nom,
    role: collabDemo.role,
    margeRealisee: 4800 + Math.random() * 2000, // 4800 à 6800
    nbMobiles: 12 + Math.floor(Math.random() * 8),
    nbGaranties: 5 + Math.floor(Math.random() * 4),
    nbCyber: 8 + Math.floor(Math.random() * 6),
    nbAssurances: 6 + Math.floor(Math.random() * 5),
    nbMobilesAssurance: 14,
    caAccessoires: 250 + Math.random() * 150,
    jourOuvre: 14,
    nbJoursOuvres: 22,
    joursTravailles: 19
  };

  return calculerCommissions(collab, DEMO_ITEMS, CONFIG.moisEnCours, new Date().toLocaleString('fr-FR'));
}

/**
 * Calcule les commissions (logique partagée)
 *
 * jourOuvre = jour ouvré courant dans le mois (ex: 14ème jour)
 * nbJoursOuvres = nb total de jours ouvrés du mois (ex: 22)
 * joursTravailles = nb de jours que CE vendeur travaille dans le mois (ex: 19)
 *   → sert à proratiser les objectifs volumiques (Mobiles, Cyber)
 *   → la projection se fait sur joursTravailles, pas sur nbJoursOuvres
 */
function calculerCommissions(collab, items, moisEnCours, derniereMaj) {
  // Éviter division par zéro
  if (collab.jourOuvre <= 0) collab.jourOuvre = 1;
  if (collab.nbJoursOuvres <= 0) collab.nbJoursOuvres = 22;
  if (!collab.joursTravailles || collab.joursTravailles <= 0) collab.joursTravailles = collab.nbJoursOuvres;

  // Calculer combien de jours travaillés sont déjà écoulés
  // = min(jourOuvre, joursTravailles) car on ne peut pas avoir travaillé plus que le jour courant
  const joursTravaillesEcoules = Math.min(collab.jourOuvre, collab.joursTravailles);

  // ===== CALCULS =====
  const ratio = joursTravaillesEcoules / collab.joursTravailles; // Progression dans le mois
  const coefProjection = collab.joursTravailles / joursTravaillesEcoules; // Projeter sur les jours travaillés

  // 1. Projection de marge
  const margeProjetee = collab.margeRealisee * coefProjection;

  // 2. Commission sur marge (réalisée et projetée)
  const paliers = collab.role === "RPV" ? PALIERS_RPV : PALIERS_VENDEUR;
  const commissionRealisee = calculerCommissionMarge(collab.margeRealisee, paliers);
  const commissionProjetee = calculerCommissionMarge(margeProjetee, paliers);

  // 3. Calcul des items (avec prorata des objectifs volumiques)
  const prorata = collab.joursTravailles / collab.nbJoursOuvres; // ex: 19/22 = 0.863
  const itemsResultat = calculerItems(collab, items, coefProjection, prorata);
  const nbItemsAtteints = itemsResultat.filter(it => it.projectionAtteint).length;
  const tauxItems = items.length > 0 ? nbItemsAtteints / items.length : 1;

  // 4. Commission modulée par les items
  const commissionModuleeRealisee = commissionRealisee * tauxItems;
  const commissionModuleeProjetee = commissionProjetee * tauxItems;

  // 5. Total projeté
  const totalProjete = commissionModuleeProjetee;

  // Trouver le palier actuel et le prochain
  const palierActuel = trouverPalier(margeProjetee, paliers);
  const palierSuivant = trouverPalierSuivant(margeProjetee, paliers);

  return {
    collab: {
      nom: collab.nom,
      boutique: BOUTIQUES[collab.codeBoutique] || collab.codeBoutique,
      codeBoutique: collab.codeBoutique,
      role: collab.role
    },
    mois: moisEnCours,
    derniereMaj: derniereMaj,
    progression: {
      jourOuvre: collab.jourOuvre,
      nbJoursOuvres: collab.nbJoursOuvres,
      joursTravailles: collab.joursTravailles,
      joursTravaillesEcoules: joursTravaillesEcoules,
      ratio: ratio
    },
    marge: {
      realisee: Math.round(collab.margeRealisee),
      projetee: Math.round(margeProjetee),
      palierActuel: palierActuel,
      palierSuivant: palierSuivant,
      manquePourProchainPalier: palierSuivant ? Math.max(0, palierSuivant.min - margeProjetee) : 0
    },
    commission: {
      bruteRealisee: Math.round(commissionRealisee),
      bruteProjetee: Math.round(commissionProjetee),
      moduleeRealisee: Math.round(commissionModuleeRealisee),
      moduleeProjetee: Math.round(commissionModuleeProjetee),
      tauxItems: tauxItems,
      nbItemsAtteints: nbItemsAtteints,
      nbItemsTotal: items.length
    },
    items: itemsResultat,
    total: {
      projete: Math.round(totalProjete),
      detail: "Commission marge modulée par items"
    }
  };
}

// ===== FONCTIONS DE CALCUL =====

/**
 * Calcule la commission en fonction de la marge et du palier
 */
function calculerCommissionMarge(marge, paliers) {
  for (let i = paliers.length - 1; i >= 0; i--) {
    if (marge >= paliers[i].min) {
      return marge * paliers[i].pct;
    }
  }
  return 0;
}

/**
 * Calcule les résultats des items (réalisé, projeté, statut)
 *
 * prorata = joursTravailles / nbJoursOuvres (ex: 19/22 = 0.863)
 * Les objectifs volumiques (Mobiles, SFR Cyber) sont proratisés :
 *   objectifProratisé = Math.round(objectifBase × prorata)
 * Les objectifs en % ou €/vente ne sont PAS proratisés.
 */
function calculerItems(collab, items, coefProjection, prorata) {
  return items.map(item => {
    let realise, projete, objectif, objectifBase, pctAtteinte, projectionAtteint;

    switch (item.nom) {
      case "Mobiles":
        realise = collab.nbMobiles;
        projete = Math.round(realise * coefProjection);
        objectifBase = item.objectif;
        objectif = Math.round(objectifBase * prorata); // Proratisé par jours travaillés
        pctAtteinte = objectif > 0 ? realise / objectif : 0;
        projectionAtteint = projete >= objectif;
        break;

      case "Garantie 3ème Année":
        // Taux d'attachement = nb garanties / nb mobiles
        realise = collab.nbMobiles > 0 ? (collab.nbGaranties / collab.nbMobiles) * 100 : 0;
        // On projette numérateur et dénominateur séparément
        const garantiesProj = collab.nbGaranties * coefProjection;
        const mobilesProj = collab.nbMobiles * coefProjection;
        projete = mobilesProj > 0 ? (garantiesProj / mobilesProj) * 100 : 0;
        objectifBase = item.objectif;
        objectif = item.objectif; // Pas de prorata (c'est un %)
        pctAtteinte = objectif > 0 ? realise / objectif : 0;
        projectionAtteint = projete >= objectif;
        realise = Math.round(realise);
        projete = Math.round(projete);
        break;

      case "SFR Cyber":
        realise = collab.nbCyber;
        projete = Math.round(realise * coefProjection);
        objectifBase = item.objectif;
        objectif = Math.round(objectifBase * prorata); // Proratisé par jours travaillés
        pctAtteinte = objectif > 0 ? realise / objectif : 0;
        projectionAtteint = projete >= objectif;
        break;

      case "Taux d'Assurance":
        realise = collab.nbMobilesAssurance > 0 ? (collab.nbAssurances / collab.nbMobilesAssurance) * 100 : 0;
        const assurProj = collab.nbAssurances * coefProjection;
        const mobAssurProj = collab.nbMobilesAssurance * coefProjection;
        projete = mobAssurProj > 0 ? (assurProj / mobAssurProj) * 100 : 0;
        objectifBase = item.objectif;
        objectif = item.objectif; // Pas de prorata (c'est un %)
        pctAtteinte = objectif > 0 ? realise / objectif : 0;
        projectionAtteint = projete >= objectif;
        realise = Math.round(realise);
        projete = Math.round(projete);
        break;

      case "Taux d'Accessoire":
        realise = collab.nbMobiles > 0 ? collab.caAccessoires / collab.nbMobiles : 0;
        const caAccProj = collab.caAccessoires * coefProjection;
        const mobAccProj = collab.nbMobiles * coefProjection;
        projete = mobAccProj > 0 ? caAccProj / mobAccProj : 0;
        objectifBase = item.objectif;
        objectif = item.objectif; // Pas de prorata (c'est un €/vente)
        pctAtteinte = objectif > 0 ? realise / objectif : 0;
        projectionAtteint = projete >= objectif;
        realise = Math.round(realise);
        projete = Math.round(projete);
        break;

      default:
        realise = 0;
        projete = 0;
        objectifBase = item.objectif;
        objectif = item.objectif;
        pctAtteinte = 0;
        projectionAtteint = false;
    }

    return {
      nom: item.nom,
      realise: realise,
      projete: projete,
      objectif: objectif,
      objectifBase: objectifBase || objectif, // Objectif avant prorata
      unite: item.unite,
      poids: item.poids,
      pctAtteinte: Math.min(pctAtteinte, 1.5), // Cap à 150%
      projectionAtteint: projectionAtteint,
      statut: pctAtteinte >= 1 ? "atteint" : pctAtteinte >= 0.7 ? "en_cours" : "danger"
    };
  });
}

/**
 * Trouve le palier actuel pour une marge donnée
 */
function trouverPalier(marge, paliers) {
  for (let i = paliers.length - 1; i >= 0; i--) {
    if (marge >= paliers[i].min) {
      return { min: paliers[i].min, max: paliers[i].max, pct: Math.round(paliers[i].pct * 100) };
    }
  }
  return paliers[0];
}

/**
 * Trouve le palier suivant à atteindre
 */
function trouverPalierSuivant(marge, paliers) {
  for (let i = 0; i < paliers.length; i++) {
    if (marge < paliers[i].max && marge >= paliers[i].min) {
      if (i + 1 < paliers.length) {
        return { min: paliers[i + 1].min, max: paliers[i + 1].max, pct: Math.round(paliers[i + 1].pct * 100) };
      }
      return null;
    }
  }
  return null;
}
