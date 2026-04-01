# Web App Commissions Projetées — Groupe Garcia

Une application Web mobile permettant aux collaborateurs des boutiques SFR du Groupe Garcia de consulter **en temps réel** leur projection de commission mensuelle.

## Fichiers de ce dossier

### 1. `Code.gs` (Backend Google Apps Script)
- **450 lignes** de code JavaScript côté serveur
- **10 fonctions** complètes
- Lit les données depuis un Google Sheet source
- Calcule les commissions selon le barème du payplan (paliers de marge, items, primes Critizr)
- **Mode démo inclus** : si le Sheet n'est pas configuré, l'appli affiche des données fictives réalistes
- Fonctions principales :
  - `doGet()` : sert la page HTML
  - `getCollaborateurs()` : liste pour le dropdown
  - `getCommissionsData(nom)` : calcul complet des commissions
  - Fonctions utilitaires (paliers, items, primes)

### 2. `Commissions.html` (Frontend)
- **840 lignes** d'HTML + CSS + JavaScript
- **Tout-en-un** : pas de fichiers externes
- Interface mobile-first optimisée tactile
- Design SFR : rouge #e60000, fond gris #f0f2f5, cards blanches border-radius 16px
- **4 écrans** :
  1. **Connexion** : sélection du collaborateur
  2. **Dashboard** : 4 cards (Commission, Marge, Items, Primes)
  3. **Loading** : spinner pendant le calcul
  4. **Animations** : jauges circulaires et barres de progression
- Communication avec backend via `google.script.run` (pas de fetch)
- Bouton retour pour changer de collaborateur

### 3. `GUIDE_DEPLOIEMENT.md` (Déploiement pas-à-pas)
- **310 lignes** : guide complet étape par étape
- 7 étapes :
  1. Créer le Google Sheet source
  2. Remplir la structure (3 onglets)
  3. Copier l'ID du Sheet
  4. Créer la Web App dans Apps Script
  5. Déployer comme "Application Web"
  6. Partager avec les collaborateurs
  7. Tester et dépanner
- Inclut :
  - Création et remplissage des onglets
  - Configuration du `CONFIG.idSheet`
  - Redéploiement et mise à jour
  - Dépannage des erreurs courantes

### 4. `STRUCTURE_SHEET.md` (Structure Google Sheet)
- **295 lignes** : documentation complète du Sheet
- Structure de **3 onglets** :
  1. **Données_Commissions** : 14 colonnes (marge, items, notes, jour courant)
  2. **Items_Mois** : objectifs mensuels (5 items)
  3. **Config** : mois en cours, date MAJ
- Exemples de données réelles
- Sources d'alimentation (3GWIN, manuel, formules)
- Validations et formatage optionnel
- Checklist de création

## Fonctionnalités principales

### Dashboard
1. **Commission Projetée** (Card 1)
   - Gros montant en euros
   - Jauge circulaire animée
   - Réalisé à date en dessous
   - Progression (jour courant / nb jours du mois)

2. **Marge** (Card 2)
   - Réalisée vs Projetée
   - Palier actuel et prochain
   - Montant manquant pour prochain palier

3. **Items du Mois** (Card 3)
   - 5 items (Mobiles, Garantie, Cyber, Assurance, Accessoires)
   - Réalisé vs Objectif
   - Barres de progression colorées (vert/orange/rouge)
   - Projection fin de mois pour chaque item

4. **Primes & Malus** (Card 4)
   - Note Critizr avec prime/malus correspondant
   - Note Google avec info trimestrielle

### Logique de calcul
- **Projection linéaire** : rythme actuel extrapolé à fin de mois
- **Paliers de marge** : 9 paliers de commission (0% à 10%)
- **Modulation items** : chaque item = 20% de la commission (5 items = 5 × 20%)
- **Primes Critizr** : +100€ (4.9), +50€ (4.7), +25€ (4.5), -50€ (4.3), -100€ (sinon)
- **Prime Google** : +100€/trimestre (seuil 4.7)

### Barèmes
- **Vendeur** : paliers de 2% à 10% selon marge
- **RPV Cholet** : barème spécifique (1% à 3%)

### Mode démo
- Si `CONFIG.idSheet` est vide (non configuré)
- L'appli affiche 5 collaborateurs fictifs
- Données réalistes (4500-6800€ de marge)
- Permet de tester l'interface sans Sheet

## Architecture

```
┌─────────────────────────────────────────┐
│         Google Sheet Source             │
│  (Données_Commissions, Items_Mois)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    Google Apps Script (Code.gs)         │
│  - doGet() → sert HTML                  │
│  - getCollaborateurs() → dropdown       │
│  - getCommissionsData() → calculs       │
└──────────────┬──────────────────────────┘
               │
               │ google.script.run
               │
               ▼
┌─────────────────────────────────────────┐
│      HTML + CSS + JS (Frontend)         │
│  - Connexion (select)                   │
│  - Dashboard (4 cards)                  │
│  - Jauges animées                       │
│  - Responsive mobile                    │
└─────────────────────────────────────────┘
```

## Démarrage rapide

### Pour un développeur
1. Copier `Code.gs` et `Commissions.html` dans un Apps Script project
2. Remplir `CONFIG.idSheet` avec l'ID du Sheet
3. Déployer comme "Application Web"
4. Obtenir l'URL et la partager

### Pour un utilisateur final
1. Ouvrir l'URL fournie dans un navigateur mobile
2. Sélectionner son nom
3. Voir le dashboard avec ses commissions

## Caractéristiques techniques

- **Pas de dépendances externes** : vanilla JS + CSS
- **Responsive** : optimisé mobile (max-width 500px)
- **Offline-compatible** : pas de requêtes externes
- **Léger** : ~50KB total
- **Animations fluides** : CSS transitions + jauges SVG
- **Mode démo intégré** : fonctionne sans Sheet configuré

## Maintenance

### Mise à jour mensuelle
- Remplir le Google Sheet avec les nouvelles données
- Modifier l'onglet "Config" (mois, objectifs Items_Mois)
- Rien à changer dans le code

### Modification du barème
- Édit les constantes en haut de `Code.gs`
- `PALIERS_VENDEUR`, `PALIERS_RPV`, `PRIMES_CRITIZR`
- Redéployer

### Ajout/suppression de collaborateurs
- Ajouter/supprimer des lignes dans Données_Commissions
- L'appli relira automatiquement

## Support et dépannage

Voir `GUIDE_DEPLOIEMENT.md` section "Dépannage" pour les erreurs courantes.

## Historique des versions

**v1.0** (Avril 2026)
- Sortie initiale
- 5 collaborateurs de test
- Mode démo fonctionnel
- Déploiement sur 6 boutiques

---

**Groupe Garcia** — Boutiques SFR Angers, Amboise, Châteaudun, Cholet, Romorantin, Vendôme
