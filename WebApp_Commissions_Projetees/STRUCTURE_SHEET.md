# Structure du Google Sheet — Commissions Projetées

Ce document détaille la structure exacte du Google Sheet source pour l'application Web App Commissions Projetées.

---

## Vue d'ensemble

Le Sheet contient **5 onglets** :

1. **Données_Commissions** — Données brutes par collaborateur (alimenté automatiquement par SyncMobPlace.gs)
2. **Items_Mois** — Objectifs mensuels des 5 items du payplan
3. **Config** — Configuration générale (mois, dates) — mis à jour automatiquement
4. **Mapping_Vendeurs** — Correspondance vendeur → boutique → rôle (créé automatiquement, à ajuster manuellement)
5. **RAF** — Jours travaillés individuels par vendeur (à remplir manuellement chaque mois)

---

## Onglet 1 : "Données_Commissions"

### Objectif
Contenir les données individuelles de chaque collaborateur : marge, items vendus, progression dans le mois.

**Cet onglet est alimenté automatiquement** par le script `SyncMobPlace.gs` qui lit les emails mob.place.

### Structure des colonnes

```
Colonne | Intitulé                          | Type      | Exemple
--------|-----------------------------------|-----------|----------
A       | Code boutique                     | Texte     | ALR
B       | Nom collaborateur                 | Texte     | Jean Dupont
C       | Rôle                             | Texte     | Vendeur / RPV
D       | Marge réalisée (€) mois en cours | Nombre    | 4500
E       | Nb mobiles vendus                | Nombre    | 12
F       | Nb garanties 3ème année vendues  | Nombre    | 5
G       | Nb SFR Cyber vendus              | Nombre    | 8
H       | Nb assurances vendues            | Nombre    | 6
I       | Nb mobiles pour taux assurance   | Nombre    | 12
J       | CA accessoires total (€)         | Nombre    | 280
K       | Jour ouvré courant du mois       | Nombre    | 14
L       | Nb jours ouvrés total du mois    | Nombre    | 22
M       | Jours travaillés (individuel)    | Nombre    | 19
```

### Exemple de données

```
A       B               C        D     E   F  G  H  I   J    K   L   M
ALR     Axel            Vendeur  4500  12  5  8  6  12  280  14  22  22
ALR     Pauline         Vendeur  5200  14  6  9  7  14  320  14  22  17
TLR     Hassene         Vendeur  3800  10  4  6  5  10  240  14  22  22
CHOLET  Anais           Vendeur  4100  11  5  7  6  11  250  14  22  19
CHOLET  Sophie Bernard  RPV      18500 45  20 30 25 45  1200 14  22  22
```

### Notes importantes

- **Ligne 1** = En-têtes
- **À partir de la ligne 2** = Données des collaborateurs (une ligne par personne)
- **Rôle** : "Vendeur" (barème standard) ou "RPV" (barème Cholet spécifique)
- **Colonnes K-L** : calculées automatiquement par SyncMobPlace.gs (jours ouvrés du mois en cours, hors week-ends et jours fériés français)
- **Colonne M** : jours travaillés individuels, lus depuis l'onglet RAF. Si absent, = colonne L (jours ouvrés total). Sert à proratiser les objectifs volumiques (Mobiles, SFR Cyber) et à projeter sur les jours réellement travaillés.
- **Colonnes D-J** : importées automatiquement depuis les pages 3GWIN

---

## Onglet 2 : "Items_Mois"

### Objectif
Définir les 5 items du mois et leurs objectifs. **À modifier manuellement chaque mois** (en début de mois, quand les nouveaux objectifs sont communiqués).

### Structure des colonnes

```
Colonne | Intitulé         | Type   | Exemple
--------|------------------|--------|----------------
A       | Nom de l'item    | Texte  | Mobiles
B       | Objectif         | Nombre | 20
C       | Unité            | Texte  | unités / % / €/vente
D       | Poids (% rému)   | Texte  | 20%
```

### Données pour Avril 2026

```
A                      B   C        D
Mobiles                20  unités   20%
Garantie 3ème Année    50  %        20%
SFR Cyber              15  unités   20%
Taux d'Assurance       40  %        20%
Taux d'Accessoire      30  €/vente  20%
```

### Modification mensuelle

Chaque mois, mettre à jour la colonne B avec les nouveaux objectifs communiqués dans le payplan du mois.

---

## Onglet 3 : "Config"

### Objectif
Stocker le mois en cours et la date de dernière mise à jour. **Mis à jour automatiquement par SyncMobPlace.gs.**

### Structure

```
Ligne | A (Label)           | B (Valeur)
1     | Mois en cours       | Dernière MAJ
2     | Avril 2026          | 01/04/2026 19:30
```

---

## Onglet 4 : "Mapping_Vendeurs"

### Objectif
Faire la correspondance entre le nom du vendeur (tel qu'il apparaît dans les emails mob.place) et sa boutique + son rôle. **Créé automatiquement au premier lancement de SyncMobPlace.gs**, avec un mapping par défaut à ajuster.

### Structure

```
Colonne | Intitulé                    | Exemple
--------|-----------------------------|----------
A       | Nom Vendeur (MAJUSCULES)    | HASSENE
B       | Code Boutique               | TLR
C       | Rôle                        | Vendeur
```

### Mapping par défaut (créé automatiquement)

| Vendeur | Boutique | Rôle |
|---------|----------|------|
| HASSENE | TLR | Vendeur |
| JULIE TLR | TLR | Vendeur |
| AXEL | ALR | Vendeur |
| PAULINE | ALR | Vendeur |
| RACHEL | CLR | Vendeur |
| ILIAN | CLR | Vendeur |
| ANAIS | CHOLET | Vendeur |
| LUCAS | CHOLET | Vendeur |
| LOUANE | CHOLET | Vendeur |
| EMMY | CHOLET | Vendeur |
| CHLOE R | CHOLET | Vendeur |
| WILL | RLR | Vendeur |
| EMILIE | RLR | Vendeur |
| NATHAN | RLR | Vendeur |
| MEHDY | VLR | Vendeur |
| ROMAIN GP | VLR | RPV |

### Modification

Quand un vendeur change de boutique ou qu'un nouveau collaborateur arrive :
1. Ouvrir l'onglet Mapping_Vendeurs
2. Ajouter/modifier la ligne avec le nom exact en MAJUSCULES
3. La prochaine synchronisation utilisera le nouveau mapping

---

## Onglet 5 : "RAF"

### Objectif
Stocker les jours travaillés individuels de chaque vendeur pour le mois en cours. **À modifier manuellement chaque mois** en début de mois, à partir du planning/RAF communiqué.

### Structure des colonnes

```
Colonne | Intitulé                    | Type    | Exemple
--------|-----------------------------|---------|----------
A       | Nom vendeur (MAJUSCULES)    | Texte   | ANAIS
B       | Jours travaillés            | Nombre  | 19
```

### Données pour Avril 2026

```
A           B
ANAIS       19
AXEL        22
CHLOE R     11
EMILIE      20
EMMY        6
HASSENE     22
ILIAN       13
JULIE TLR   10
LUCAS       21
MEHDY       22
NATHAN      13
PAULINE     17
RACHEL      9
WILL        22
```

### Notes importantes

- **Ligne 1** = En-têtes
- **Noms en MAJUSCULES** exactement comme dans l'onglet Mapping_Vendeurs
- Si un vendeur n'est PAS dans cet onglet, ses jours travaillés = jours ouvrés total du mois (colonne L)
- Les objectifs volumiques (Mobiles, SFR Cyber) sont proratisés : `objectif × (joursTravailles / nbJoursOuvrés)`
- La projection se fait sur les jours travaillés, pas sur les jours ouvrés du mois

---

## Alimentation automatique

### Comment ça fonctionne

1. **Chaque jour à 19h01**, mob.place envoie un email "Vos chiffres :Vendeurs mois" à votre adresse Gmail
2. **Chaque heure**, le script `SyncMobPlace.gs` cherche le dernier email mob.place dans Gmail
3. Il parse les données du tableau HTML contenu dans l'email
4. Il écrit les données dans l'onglet Données_Commissions
5. Il met à jour la date de dernière MAJ dans Config
6. La Web App lit ces données en temps réel quand un vendeur se connecte

### Schéma du flux

```
mob.place (19h01) → Email Gmail → SyncMobPlace.gs (toutes les heures)
                                        ↓
                              Google Sheet "Données_Commissions"
                                        ↓
                              Web App Commissions (lecture)
                                        ↓
                              Vendeur voit sa commission projetée
```

### Première mise en place

1. Créer le Google Sheet avec les 3 onglets (Données_Commissions, Items_Mois, Config)
2. Remplir Items_Mois avec les objectifs du mois
3. Copier l'ID du Sheet
4. Coller l'ID dans `SYNC_CONFIG.idSheet` (dans SyncMobPlace.gs) ET dans `CONFIG.idSheet` (dans Code.gs)
5. Lancer `setupTrigger()` une fois dans l'éditeur Apps Script
6. Lancer `syncMobPlace()` manuellement pour la première synchronisation
7. Vérifier que les données apparaissent dans le Sheet
8. Tester la Web App

---

## Checklist de création

- [ ] Créer un Google Sheet nommé "Commissions_Données_Groupe_Garcia"
- [ ] Créer 4 onglets : Données_Commissions, Items_Mois, Config, RAF
- [ ] Remplir les en-têtes de Données_Commissions (colonnes A à M)
- [ ] Remplir les 5 items dans Items_Mois
- [ ] Remplir la Config (mois en cours)
- [ ] Remplir l'onglet RAF avec les jours travaillés individuels du mois
- [ ] Copier l'ID du Sheet (dans l'URL, entre /d/ et /edit)
- [ ] Coller l'ID dans SyncMobPlace.gs → SYNC_CONFIG.idSheet
- [ ] Coller l'ID dans Code.gs → CONFIG.idSheet
- [ ] Lancer setupTrigger() dans l'éditeur Apps Script
- [ ] Lancer syncMobPlace() pour tester
- [ ] Vérifier les données dans le Sheet
- [ ] Redéployer la Web App
- [ ] L'onglet Mapping_Vendeurs se créera automatiquement — l'ajuster si besoin

---

**Version 3.0** — Groupe Garcia — Avril 2026 — Avec synchronisation 3GWIN + jours travaillés individuels (RAF)
