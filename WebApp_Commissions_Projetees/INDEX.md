# Index — Web App Commissions Projetées

Bienvenue ! Ce dossier contient une **Web App Google Apps Script complète** pour les commissions projetées du Groupe Garcia.

## Fichiers et leurs usages

### 1. Pour COMPRENDRE le projet
- **[README.md](README.md)** — Vue d'ensemble technique et architecture
- **[SYNTHESE.txt](SYNTHESE.txt)** — Résumé en texte brut des fichiers générés

### 2. Pour DÉVELOPPER / CONFIGURER
- **[Code.gs](Code.gs)** — Backend Google Apps Script (à copier dans Apps Script)
- **[Commissions.html](Commissions.html)** — Frontend HTML + CSS + JS (à copier dans Apps Script)
- **[STRUCTURE_SHEET.md](STRUCTURE_SHEET.md)** — Comment structurer le Google Sheet source

### 3. Pour DÉPLOYER
- **[GUIDE_DEPLOIEMENT.md](GUIDE_DEPLOIEMENT.md)** — Guide étape par étape (7 étapes)
- **[CHECKLIST_DEPLOIEMENT.md](CHECKLIST_DEPLOIEMENT.md)** — Checklist complète avec verifications

### 4. Ce fichier
- **[INDEX.md](INDEX.md)** — Navigation (vous êtes ici)

---

## Démarrage rapide

### Je suis gestionnaire / non-technique
1. Lire [README.md](README.md) pour comprendre le concept
2. Demander à un développeur de suivre [GUIDE_DEPLOIEMENT.md](GUIDE_DEPLOIEMENT.md)
3. Une fois déployé, partager l'URL avec les collaborateurs

### Je suis développeur
1. Lire [README.md](README.md) pour comprendre l'architecture
2. Suivre [GUIDE_DEPLOIEMENT.md](GUIDE_DEPLOIEMENT.md) étape par étape
3. Créer le Google Sheet selon [STRUCTURE_SHEET.md](STRUCTURE_SHEET.md)
4. Copier `Code.gs` et `Commissions.html` dans Google Apps Script
5. Tester avec [CHECKLIST_DEPLOIEMENT.md](CHECKLIST_DEPLOIEMENT.md)

### Je dois modifier le code
1. Consulter [Code.gs](Code.gs) pour les constantes (CONFIG, PALIERS, PRIMES)
2. Consulter [Commissions.html](Commissions.html) pour le design
3. Après modification, redéployer via "Déployer → Gérer les déploiements"

### Je dois mettre à jour les données
1. Modifier le Google Sheet (voir [STRUCTURE_SHEET.md](STRUCTURE_SHEET.md))
2. Aucune modification du code n'est nécessaire
3. L'appli relira automatiquement le Sheet

---

## Structure des fichiers

```
WebApp_Commissions_Projetees/
├── Code.gs                          (450 lignes, backend)
├── Commissions.html                 (840 lignes, frontend)
├── GUIDE_DEPLOIEMENT.md             (7 étapes de déploiement)
├── CHECKLIST_DEPLOIEMENT.md         (checklist de vérification)
├── STRUCTURE_SHEET.md               (structure Google Sheet)
├── README.md                        (architecture technique)
├── SYNTHESE.txt                     (résumé des fichiers)
└── INDEX.md                         (ce fichier)
```

---

## Contenu par fichier

### Code.gs (450 lignes)
**Contient :** Backend Google Apps Script complet

Fonctions principales :
- `doGet()` — Sert la page HTML
- `getCollaborateurs()` — Retourne la liste pour le dropdown
- `getCommissionsData(nom)` — Calcule les commissions et projections
- `calculerItems()`, `calculerPrimeCritizr()`, etc. — Fonctions utilitaires

Constantes :
- `CONFIG` — Configuration (idSheet, nomEntreprise, moisEnCours)
- `PALIERS_VENDEUR` — Barème vendeur (2% à 10%)
- `PALIERS_RPV` — Barème RPV Cholet spécifique
- `PRIMES_CRITIZR` — Primes/malus selon note Critizr
- `DEMO_COLLABORATEURS`, `DEMO_ITEMS` — Données de démo

Mode démo :
- Active automatiquement si `CONFIG.idSheet` est vide
- Affiche 5 collaborateurs fictifs avec données réalistes
- Permet de tester l'interface sans Sheet configuré

### Commissions.html (840 lignes)
**Contient :** Interface Web mobile complète

Sections :
- **CSS inline** — Styling SFR (rouge #e60000, responsive)
- **HTML** — Structure (header, login, dashboard, loading)
- **JavaScript inline** — Logique d'interaction et animation

Écrans :
1. **Login** — Sélection du collaborateur
2. **Dashboard** — 4 cards (Commission, Marge, Items, Primes)
3. **Loading** — Spinner pendant le calcul
4. **Back button** — Retour à la connexion

Animations :
- Jauge circulaire animée (SVG)
- Barres de progression (CSS)
- Fade-in sur cards (CSS)
- Responsive tactile

### GUIDE_DEPLOIEMENT.md (310 lignes)
**Contient :** Guide pas-à-pas complet de déploiement

Étapes :
1. Créer le Google Sheet source
2. Remplir la structure (3 onglets)
3. Copier l'ID du Sheet
4. Créer la Web App dans Apps Script
5. Déployer comme "Application Web"
6. Partager l'URL avec collaborateurs
7. Tester et dépanner

Inclut :
- Création des onglets
- Remplissage des colonnes
- Configuration du CONFIG.idSheet
- Instructions de déploiement
- Redéploiement et mise à jour
- Dépannage des erreurs courantes

### CHECKLIST_DEPLOIEMENT.md (295 lignes)
**Contient :** Checklist détaillée de vérification

Phases :
1. Préparation (lire la doc, préparer données)
2. Créer Google Sheet source (14 colonnes, 3 onglets)
3. Configurer Apps Script (copier fichiers, remplir CONFIG.idSheet)
4. Déployer la Web App
5. Tester l'application (6 tests différents)
6. Partager avec collaborateurs
7. Maintenance mensuelle

À cocher :
- [ ] Chaque sous-étape
- [ ] Chaque test
- [ ] Chaque vérification

### STRUCTURE_SHEET.md (295 lignes)
**Contient :** Documentation complète du Google Sheet source

Onglets (3 obligatoires) :

**1. Données_Commissions**
- 14 colonnes (Code, Nom, Rôle, Marge, Items, Notes, Jours)
- 1 ligne par collaborateur
- Exemple de 6 collaborateurs réalistes

**2. Items_Mois**
- 5 items (Mobiles, Garantie, Cyber, Assurance, Accessoires)
- Objectifs mensuels (modifiables chaque mois)

**3. Config**
- Mois en cours (texte)
- Date dernière MAJ (formule auto)

Inclut :
- Sources d'alimentation (3GWIN, manuel, formules)
- Validations optionnelles
- Formatage visuel optionnel
- Exemple complet et checklist

### README.md (200+ lignes)
**Contient :** Vue d'ensemble technique et fonctionnalités

Sections :
- Fichiers et leurs usages
- Fonctionnalités principales (4 cards)
- Logique de calcul (paliers, items, projection)
- Barèmes (vendeur, RPV)
- Mode démo
- Architecture (diagramme)
- Caractéristiques techniques
- Maintenance

### SYNTHESE.txt (100 lignes)
**Contient :** Résumé en texte brut

Utile pour :
- Vue d'ensemble rapide
- Impression ou partage par email
- Checklist de ce qui est implémenté

---

## Questions fréquentes

### Q: Par où je commence ?
**A:** 
1. Si non-technique : lire README.md
2. Si développeur : lire README.md, puis GUIDE_DEPLOIEMENT.md

### Q: Combien de temps pour déployer ?
**A:** 60 minutes environ (création Sheet + configuration + test)

### Q: L'appli fonctionne sans Sheet configuré ?
**A:** Oui ! Mode démo affiche 5 collaborateurs fictifs.

### Q: Puis-je modifier le barème de commission ?
**A:** Oui, modifier les constantes dans Code.gs, puis redéployer.

### Q: Comment mettre à jour les données chaque mois ?
**A:** Modifier le Google Sheet (onglet Données_Commissions). Aucun code à toucher.

### Q: Peut-on utiliser sur téléphone ?
**A:** Oui, design mobile-first. Ajoutable en raccourci iOS/Android.

### Q: Qui peut voir les commissions des autres ?
**A:** Seul chaque collaborateur voit ses propres commissions (accès par dropdown).

---

## Support

### Erreur lors du déploiement ?
→ Voir GUIDE_DEPLOIEMENT.md section "Dépannage"

### Montants de commission faux ?
→ Vérifier les données du Sheet (voir STRUCTURE_SHEET.md)

### Collaborateur non trouvé ?
→ Vérifier le nom dans le Sheet (majuscules/minuscules comptent)

### Questions générales ?
→ Consulter README.md ou CHECKLIST_DEPLOIEMENT.md

---

## Versions et changelog

**v1.0** (Avril 2026)
- Sortie initiale
- 10 fonctions backend complètes
- 4 cards dashboard
- Mode démo fonctionnel
- Barèmes vendeur et RPV
- Primes Critizr et Google
- Animations et responsive design

---

## Liens rapides

- [Aller à Code.gs](Code.gs)
- [Aller à Commissions.html](Commissions.html)
- [Lire GUIDE_DEPLOIEMENT.md](GUIDE_DEPLOIEMENT.md)
- [Lire STRUCTURE_SHEET.md](STRUCTURE_SHEET.md)
- [Consulter CHECKLIST_DEPLOIEMENT.md](CHECKLIST_DEPLOIEMENT.md)
- [Lire README.md](README.md)

---

**Groupe Garcia** — Boutiques SFR Angers, Amboise, Châteaudun, Cholet, Romorantin, Vendôme
