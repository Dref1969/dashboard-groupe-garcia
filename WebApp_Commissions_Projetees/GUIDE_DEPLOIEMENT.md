# Guide de déploiement — Web App Commissions Projetées

## Vue d'ensemble

Cette Web App permet aux collaborateurs des boutiques SFR du Groupe Garcia de consulter en temps réel leur projection de commission mensuelle. Elle lit les données depuis un Google Sheet alimenté par 3GWIN/mob.place et affiche les commissions calculées selon le barème du payplan.

**Durée estimée : 20 minutes**

---

## Étape 1 : Créer le Google Sheet source

### 1.1 Créer un nouveau Google Sheet

1. Allez sur [sheets.google.com](https://sheets.google.com)
2. Cliquez sur **"Créer un nouveau tableur"**
3. Renommez-le : **"Commissions_Données_Groupe_Garcia"**

### 1.2 Créer les onglets

Vous aurez besoin de **3 onglets** :
- **Données_Commissions** (données brutes par collaborateur)
- **Items_Mois** (objectifs du mois)
- **Config** (configuration générale)

Pour chaque onglet, faites un clic droit sur l'onglet en bas → **"Insérer un onglet"**.

---

## Étape 2 : Remplir la structure du Google Sheet

### 2.1 Onglet "Données_Commissions"

Cet onglet contient les données par collaborateur. Voici la structure des colonnes :

| Col | Intitulé | Exemple | Type |
|-----|----------|---------|------|
| A | Code boutique | ALR | Texte |
| B | Nom collaborateur | Jean Dupont | Texte |
| C | Rôle | Vendeur ou RPV | Texte |
| D | Marge réalisée (€) | 4500 | Nombre |
| E | Nb mobiles vendus | 12 | Nombre |
| F | Nb garanties 3ème année | 5 | Nombre |
| G | Nb SFR Cyber vendus | 8 | Nombre |
| H | Nb assurances vendues | 6 | Nombre |
| I | Nb mobiles pour assurance | 12 | Nombre |
| J | CA accessoires (€) | 280 | Nombre |
| K | Note Critizr | 4.8 | Nombre (0-5) |
| L | Note Google (trim.) | 4.7 | Nombre (0-5) |
| M | Jour ouvré courant | 14 | Nombre |
| N | Nb jours ouvrés total du mois | 22 | Nombre |

**Ligne 1 = en-têtes** (les noms exacts ci-dessus)
**À partir de la ligne 2 = données des collaborateurs**

Exemple de données pour tester :

```
Code boutique | Nom collaborateur | Rôle | Marge réalisée | Nb mobiles | ... etc
ALR           | Jean Dupont      | Vendeur | 4500 | 12 | 5 | 8 | 6 | 12 | 280 | 4.8 | 4.7 | 14 | 22
TLR           | Marie Martin     | Vendeur | 5200 | 14 | 6 | 9 | 7 | 14 | 320 | 4.6 | 4.5 | 14 | 22
CHOLET        | Sophie Bernard   | RPV     | 18500 | 45 | 20 | 30 | 25 | 45 | 1200 | 4.9 | 4.8 | 14 | 22
```

### 2.2 Onglet "Items_Mois"

Les objectifs du mois en cours (les 5 items du payplan).

| Col | Intitulé | Exemple | Type |
|-----|----------|---------|------|
| A | Nom de l'item | Mobiles | Texte |
| B | Objectif | 20 | Nombre |
| C | Unité | unités | Texte |
| D | Poids | 20% | Texte |

Exemple pour avril 2026 :

```
Nom de l'item          | Objectif | Unité | Poids
Mobiles                | 20       | unités | 20%
Garantie 3ème Année    | 50       | %      | 20%
SFR Cyber              | 15       | unités | 20%
Taux d'Assurance       | 40       | %      | 20%
Taux d'Accessoire      | 30       | €/vente| 20%
```

### 2.3 Onglet "Config"

Métadonnées et configuration générale.

| Ligne | Colonne A | Colonne B |
|-------|-----------|-----------|
| 1 | **Label** | **Valeur** |
| 2 | Mois en cours | Avril 2026 |
| 3 | Date dernière MAJ | (formule : =NOW()) |

Dans la cellule **B3**, entrez la formule : `=TEXT(NOW();"dd/mm/yyyy HH:mm")`

---

## Étape 3 : Copier l'ID du Google Sheet

1. Ouvrez le Google Sheet créé
2. Regardez l'URL : `https://docs.google.com/spreadsheets/d/**[ID_TRES_LONG]**/edit`
3. Copiez la partie entre `/d/` et `/edit` — c'est votre **ID Sheet**
4. **Notez cet ID quelque part**, vous en aurez besoin à l'étape 5.

---

## Étape 4 : Créer la Web App dans Google Apps Script

### 4.1 Créer un script Google Apps Script

1. Dans le Google Sheet, allez sur **Extensions → Apps Script**
2. Un nouvel onglet s'ouvre avec l'éditeur Apps Script
3. Supprimer le code par défaut `function myFunction() { ... }`

### 4.2 Copier les fichiers

1. **Créer un fichier `Code.gs`** :
   - Cliquez sur le **+** en haut à gauche (ou sur "Code.gs")
   - Collez le contenu complet du fichier `Code.gs` fourni

2. **Créer un fichier HTML** :
   - Cliquez sur **"+" → "HTML"**
   - Nommez-le `Commissions`
   - Collez le contenu complet du fichier `Commissions.html` fourni

### 4.3 Remplir la configuration

1. Dans l'éditeur `Code.gs`, en haut du fichier, localisez la section :

```javascript
const CONFIG = {
  idSheet: "",              // ← À REMPLIR ICI
  nomEntreprise: "Groupe Garcia",
  moisEnCours: "Avril 2026"
};
```

2. Entre les guillemets de `idSheet: ""`, collez l'ID du Google Sheet noté à l'étape 3.

Résultat :
```javascript
const CONFIG = {
  idSheet: "1234567890abcdefghijklmnopqrstuvwxyz",  // Votre vrai ID
  nomEntreprise: "Groupe Garcia",
  moisEnCours: "Avril 2026"
};
```

---

## Étape 5 : Déployer la Web App

### 5.1 Créer un déploiement

1. Dans l'éditeur Apps Script, cliquez sur **"Déployer"** (en haut à droite, bouton bleu)
2. Sélectionnez **"Nouveau déploiement"**
3. Choisissez le type : **"Application Web"**
4. Remplissez les champs :
   - **Description** : "Commissions Projetées Groupe Garcia"
   - **Exécuter en tant que** : Votre compte Google (celui qui possède le Sheet)
   - **Accès autorisé à** : "N'importe qui"

### 5.2 Autoriser l'accès

1. Google va vous demander de vous identifier et d'autoriser l'accès
2. Cliquez sur **"Autoriser"**
3. Acceptez les permissions

### 5.3 Récupérer l'URL de la Web App

Après le déploiement, Google vous affiche une URL du type :

```
https://script.google.com/macros/d/[ID_LONG]/usercontent
```

**Sauvegardez cette URL** — c'est celle que les collaborateurs utiliseront pour accéder à l'appli.

---

## Étape 6 : Partager l'accès aux collaborateurs

### 6.1 Partager le Google Sheet (optionnel)

Si vous voulez que les collaborateurs puissent aussi voir le Sheet directement :

1. Ouvrez le Google Sheet
2. Cliquez sur **"Partager"** (en haut à droite)
3. Entrez les emails des collaborateurs
4. Donnez l'accès **"Lecteur"** (lecture seule)

### 6.2 Communiquer l'URL de l'appli

Envoyez à chaque collaborateur un lien vers l'URL de la Web App (étape 5.3). Ils peuvent :
- **Ajouter la page à l'écran d'accueil** (iOS) ou **"Ajouter aux favoris"** (Android)
- **Mettre en favoris** dans le navigateur
- **Accéder via email** si vous leur envoyez le lien

---

## Étape 7 : Tester l'appli

### 7.1 Test en mode démo

Si vous n'avez pas encore rempli le Google Sheet, l'appli s'exécute en **mode démo** avec des données fictives. Cela permet de tester l'interface sans connexion au Sheet.

Pour tester :
1. Ouvrez l'URL de la Web App dans un navigateur
2. Sélectionnez un collaborateur (ex: "Jean Dupont")
3. Cliquez sur **"VOIR MES COMMISSIONS"**
4. Vous devez voir le dashboard avec 4 cards

### 7.2 Test avec vraies données

Une fois le Google Sheet rempli :

1. Assurez-vous que `CONFIG.idSheet` contient le bon ID
2. **Redéployez** l'appli (Déployer → Gérer les déploiements → Sélectionner → Mettre à jour)
3. Actualisez la page de la Web App
4. Les données du Sheet doivent maintenant s'afficher

---

## Maintenance et mise à jour

### Mettre à jour les données du mois

Chaque mois, il faut mettre à jour les données dans le Google Sheet :

1. **Onglet "Données_Commissions"** : nouvelles marges, items vendus, notes
2. **Onglet "Items_Mois"** : nouveaux objectifs si changement
3. **Onglet "Config"** : mettre à jour le mois (ex: "Mai 2026")

L'appli relira automatiquement le Sheet à chaque visite.

### Redéployer après une modification du Code.gs

Si vous modifiez le `Code.gs` :

1. Allez sur **Déployer → Gérer les déploiements**
2. Sélectionnez le déploiement existant
3. Cliquez sur l'icône crayon
4. Cliquez sur **"Mettre à jour"**
5. L'URL reste la même, la nouvelle version s'exécute automatiquement

### Changer le mois en cours

Modifiez juste la cellule B2 de l'onglet "Config" (ex: passez "Avril 2026" à "Mai 2026").

---

## Dépannage

### Erreur "Collaborateur non trouvé"

- Vérifiez que le nom dans le dropdown correspond **exactement** au nom dans la colonne B du Sheet (majuscules/minuscules comptent)

### Les données n'apparaissent pas

- Vérifiez que `CONFIG.idSheet` contient le bon ID (sans espaces)
- Vérifiez que les en-têtes de colonnes correspondent exactement (Données_Commissions, Items_Mois, Config)
- Rafraîchissez la page (F5)

### L'appli se lance mais affiche les données de démo

- C'est normal si vous n'avez pas encore configuré le `CONFIG.idSheet` ou si le Sheet n'existe pas
- Dès que vous mettez l'ID correct et relancez, l'appli bascule vers les vraies données

### Erreurs dans la console du navigateur

- Ouvrez le navigateur (F12), allez sur l'onglet "Console"
- Les erreurs s'y affichent. Envoyez la capture à l'équipe technique.

---

## Architecture technique (résumé)

```
Google Sheet (données)
        ↓
Google Apps Script (Code.gs)
        ↓
Web App HTML (Commissions.html)
        ↓ (google.script.run)
Backend (calcul des commissions)
        ↓
Interface mobile (dashboard avec 4 cards)
```

- **Code.gs** : Backend. Lit le Sheet, calcule les commissions selon le barème.
- **Commissions.html** : Frontend. Interface mobile-first, couleurs SFR (rouge #e60000).
- **Communication** : `google.script.run` (appels RPC depuis le HTML vers le Apps Script).

---

## Support

En cas de problème :

1. Consultez la section **Dépannage** ci-dessus
2. Vérifiez que le Google Sheet contient bien les bonnes données
3. Vérifiez que le `CONFIG.idSheet` est correct
4. Contactez l'équipe technique avec une capture d'écran de l'erreur

---

**Version 1.0** — Groupe Garcia — Avril 2026
