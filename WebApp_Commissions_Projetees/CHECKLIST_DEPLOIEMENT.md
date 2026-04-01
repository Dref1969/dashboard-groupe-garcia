# Checklist de déploiement — Web App Commissions Projetées

## Phase 1 : Préparation (15 min)

### Lire la documentation
- [ ] Lire `README.md` pour comprendre l'architecture
- [ ] Lire `GUIDE_DEPLOIEMENT.md` en détail
- [ ] Comprendre la structure de `STRUCTURE_SHEET.md`

### Préparer les données
- [ ] Accès Google Sheet avec données 3GWIN
- [ ] Accès Critizr/Goodays pour les notes
- [ ] Accès Google My Business pour les notes Google
- [ ] Connaître le jour courant du mois et nb jours ouvrés total

---

## Phase 2 : Créer le Google Sheet source (20 min)

### Créer le Sheet
- [ ] Aller sur sheets.google.com
- [ ] Créer "Commissions_Données_Groupe_Garcia"
- [ ] Copier l'ID du Sheet (dans l'URL)

### Créer les 3 onglets
- [ ] Onglet 1 : "Données_Commissions"
- [ ] Onglet 2 : "Items_Mois"
- [ ] Onglet 3 : "Config"

### Remplir Données_Commissions
Structure (colonnes A-N) :
- [ ] A : Code boutique
- [ ] B : Nom collaborateur
- [ ] C : Rôle (Vendeur/RPV)
- [ ] D : Marge réalisée
- [ ] E : Nb mobiles
- [ ] F : Nb garanties
- [ ] G : Nb Cyber
- [ ] H : Nb assurances
- [ ] I : Nb mobiles assurance
- [ ] J : CA accessoires
- [ ] K : Note Critizr
- [ ] L : Note Google
- [ ] M : Jour ouvré courant (ex: 14)
- [ ] N : Nb jours ouvrés total (ex: 22)

Données de test minimales :
- [ ] Minimum 3-4 collaborateurs
- [ ] 1 vendeur par boutique
- [ ] 1 RPV pour Cholet
- [ ] Marges réalistes (3500-6000€)
- [ ] Notes Critizr réalistes (4.5-5.0)

Exemple :
```
ALR | Jean Dupont | Vendeur | 4500 | 12 | 5 | 8 | 6 | 12 | 280 | 4.8 | 4.7 | 14 | 22
```

### Remplir Items_Mois
- [ ] A1 : "Nom de l'item"
- [ ] B1 : "Objectif"
- [ ] C1 : "Unité"
- [ ] D1 : "Poids"
- [ ] Ajouter 5 items (Mobiles, Garantie, Cyber, Assurance, Accessoires)
- [ ] Chaque item a 20% de poids

### Remplir Config
- [ ] A1 : "Label"  | B1 : "Valeur"
- [ ] A2 : "Mois en cours" | B2 : "Avril 2026" (ou mois courant)
- [ ] A3 : "Date dernière MAJ" | B3 : "=TEXT(NOW();"dd/mm/yyyy HH:mm")"

### Vérifier le Sheet
- [ ] 14 colonnes bien remplies
- [ ] Aucune ligne vide
- [ ] Pas d'erreurs de formules
- [ ] Toutes les notes entre 0-5
- [ ] Jour ouvré < nb jours ouvrés total

---

## Phase 3 : Configurer Apps Script (15 min)

### Créer le projet Apps Script
- [ ] Dans Google Sheet : Extensions → Apps Script
- [ ] Un onglet "Code.gs" s'ouvre
- [ ] Supprimer le code par défaut

### Copier Code.gs
- [ ] Ouvrir le fichier "Code.gs" fourni
- [ ] Copier tout le contenu
- [ ] Coller dans l'éditeur Apps Script
- [ ] Vérifier qu'il n'y a pas d'erreurs de syntaxe

### Copier Commissions.html
- [ ] Cliquer sur "+" → "HTML"
- [ ] Nommer le fichier : "Commissions"
- [ ] Ouvrir le fichier "Commissions.html" fourni
- [ ] Copier tout le contenu
- [ ] Coller dans le fichier HTML Apps Script

### Configurer CONFIG.idSheet
- [ ] Aller sur "Code.gs"
- [ ] Trouver la section `const CONFIG = { ... }`
- [ ] Dans `idSheet: ""`, coller l'ID du Sheet
- [ ] Vérifier qu'il n'y a qu'une longue chaîne alphanumériques (pas d'espaces)

Exemple :
```javascript
const CONFIG = {
  idSheet: "1F9-qkX2j8xYuZaBcD1e2FgHiJkLmNoPqR3sT4uVwXyZaBcDefGhIjKlMnOpQrSt",
  nomEntreprise: "Groupe Garcia",
  moisEnCours: "Avril 2026"
};
```

### Tester le code en local (optionnel)
- [ ] Appuyer sur Ctrl+Enter pour tester
- [ ] Vérifier qu'il n'y a pas d'erreurs

---

## Phase 4 : Déployer la Web App (10 min)

### Créer un déploiement
- [ ] Cliquer sur "Déployer" (bouton bleu en haut)
- [ ] Sélectionner "Nouveau déploiement"
- [ ] Choisir type : "Application Web"

### Configurer le déploiement
- [ ] Description : "Commissions Projetées Groupe Garcia"
- [ ] Exécuter en tant que : Votre compte Gmail
- [ ] Accès autorisé à : "N'importe qui"
- [ ] Cliquer "Déployer"

### Autoriser l'accès
- [ ] Google demande l'identification
- [ ] Cliquer "Autoriser" pour permettre l'accès au Sheet
- [ ] Accepter les permissions demandées

### Récupérer l'URL
- [ ] Après le déploiement, une URL s'affiche :
  `https://script.google.com/macros/d/[ID_LONG]/usercontent`
- [ ] Copier cette URL
- [ ] Sauvegarder dans un document
- [ ] Tester la URL dans un navigateur

---

## Phase 5 : Tester l'application (15 min)

### Test 1 : Interface de connexion
- [ ] Ouvrir la URL de la Web App
- [ ] Vérifier que le dropdown se charge
- [ ] Vérifier qu'on voit la liste des collaborateurs du Sheet
- [ ] Essayer de sélectionner différents noms

### Test 2 : Dashboard
- [ ] Sélectionner un collaborateur
- [ ] Cliquer "VOIR MES COMMISSIONS"
- [ ] Vérifier que le dashboard s'affiche (pas d'erreur)
- [ ] Attendre le chargement

### Test 3 : Cards du dashboard
- [ ] [ ] **Card 1 (Commission)** :
    - Montant en gros caractères rouges
    - Jauge circulaire qui s'anime
    - Réalisé à date en dessous
    - Jour courant / nb jours total

- [ ] **Card 2 (Marge)** :
    - Marge réalisée et projetée
    - Palier actuel avec % et montant
    - Si il y a un prochain palier, affichage du montant manquant

- [ ] **Card 3 (Items)** :
    - 5 items avec réalisé/objectif
    - Barres de progression colorées (vert/orange/rouge)
    - Statut (Atteint/En cours/Danger)
    - Projection fin de mois pour chaque item

- [ ] **Card 4 (Primes)** :
    - Note Critizr avec prime/malus
    - Note Google avec info trimestrielle

- [ ] **Footer** :
    - Date de dernière MAJ
    - Lien/info version

### Test 4 : Interactions
- [ ] Scroller le dashboard (responsive)
- [ ] Cliquer sur le bouton retour (flèche rouge en bas à droite)
- [ ] Vérifier qu'on revient à l'écran de connexion
- [ ] Sélectionner un autre collaborateur
- [ ] Vérifier que les données changent

### Test 5 : Mode démo (optionnel)
- [ ] Temporairement, mettre `CONFIG.idSheet = ""` (vide)
- [ ] Redéployer
- [ ] Tester que l'appli marche avec données fictives
- [ ] Remettre l'ID correct et redéployer

### Test 6 : Responsive mobile
- [ ] Redimensionner le navigateur en mobile (DevTools F12)
- [ ] Vérifier que les cards sont lisibles
- [ ] Vérifier que les boutons sont tactiles
- [ ] Tester sur téléphone réel si possible

---

## Phase 6 : Partager avec les collaborateurs (5 min)

### Partager le Sheet (optionnel)
- [ ] Aller sur Google Sheet
- [ ] Cliquer "Partager"
- [ ] Donner accès "Lecteur" aux responsables

### Communiquer l'URL
- [ ] Envoyer par email l'URL de la Web App
- [ ] Modèle d'email :
  ```
  Bonjour,

  Vous pouvez maintenant consulter votre projection de commission
  via cette application mobile :

  [URL Web App]

  Comment l'utiliser :
  1. Cliquez sur le lien ci-dessus
  2. Sélectionnez votre nom
  3. Cliquez "VOIR MES COMMISSIONS"

  L'appli fonctionne sur téléphone et ordinateur.
  Vous pouvez l'ajouter à l'écran d'accueil (iOS/Android).

  Toute question : contactez l'équipe technique.
  ```

### Ajouter à l'écran d'accueil (optionnel)
- [ ] Partager les instructions pour ajouter en raccourci :
  - iOS : Safari → Partager → "Sur l'écran d'accueil"
  - Android : Chrome → Menu → "Installer l'appli"

---

## Phase 7 : Maintenance et suivi (mensuel)

### Mise à jour quotidienne/hebdomadaire
- [ ] Actualiser le Google Sheet avec nouvelles données
- [ ] Marges et items depuis 3GWIN
- [ ] Notes Critizr/Goodays
- [ ] Notes Google My Business
- [ ] Rien à changer dans le code

### Mise à jour mensuelle
- [ ] Modifier Config onglet B2 (nouveau mois)
- [ ] Mettre à jour Items_Mois avec nouveaux objectifs (si changement)
- [ ] Vérifier que jour ouvré courant est reset (1 ou 0 si avant le 1er)

### Redéploiement (si modif Code.gs)
- [ ] Cliquer "Déployer" → "Gérer les déploiements"
- [ ] Sélectionner le déploiement existant
- [ ] Cliquer l'icône crayon
- [ ] Cliquer "Mettre à jour"
- [ ] URL reste la même

### Monitoring
- [ ] Vérifier qu'aucun collaborateur ne signale d'erreur
- [ ] Vérifier que les montants de commission ont du sens
- [ ] Vérifier que les dates de MAJ sont à jour

---

## Dépannage rapide

### L'appli affiche "Collaborateur non trouvé"
- [ ] Vérifier le nom exact dans le Sheet (majuscules/minuscules)
- [ ] Le nom dans la colonne B doit correspondre exactement

### Les montants semblent faux
- [ ] Vérifier les marges dans le Sheet (colonne D)
- [ ] Vérifier les jours ouvrés (colonne M et N)
- [ ] Vérifier le rôle (Vendeur vs RPV)

### L'appli affiche data fictive (mode démo)
- [ ] C'est normal si CONFIG.idSheet n'est pas configuré
- [ ] Vérifier que vous avez bien mis l'ID du Sheet
- [ ] Vérifier qu'il n'y a pas d'espaces

### Erreurs dans la console
- [ ] F12 → Onglet "Console"
- [ ] Copier le message d'erreur
- [ ] Vérifier qu'un Sheet avec les bons onglets existe

---

## Checklist finale

- [ ] Tous les tests sont passés
- [ ] Les collaborateurs ont reçu l'URL
- [ ] L'appli est accessible depuis mobile
- [ ] Les montants de commission sont corrects
- [ ] Le design ressemble aux maquettes
- [ ] Aucune erreur dans la console
- [ ] La date de MAJ s'affiche correctement

---

**Félicitations !** L'appli est prête pour la production.

Pour toute question, consulter :
- `GUIDE_DEPLOIEMENT.md` pour les détails
- `STRUCTURE_SHEET.md` pour la structure des données
- `README.md` pour l'architecture technique
