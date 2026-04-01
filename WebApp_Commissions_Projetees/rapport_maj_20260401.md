# Rapport MAJ Web App Commissions — 1er Avril 2026

**Date** : 01/04/2026 ~06:00 UTC
**Tâche** : maj-webapp-commissions (exécution automatique)

## Résumé

La récupération des données 3GWIN a été effectuée avec succès sur les 8 liens (Vendeurs mois, Mags mois, et 6 boutiques individuelles). Cependant, la mise à jour du Google Sheet n'a pas pu être effectuée car Chrome n'était pas disponible pour l'authentification Google.

## État des données 3GWIN

Nous sommes le **1er avril 2026**, premier jour du mois. Voici ce que montrent les pages 3GWIN :

| Boutique | Période affichée | Données avril | Vendeurs individuels |
|----------|-----------------|---------------|---------------------|
| Amboise (TLR) | 01/04/26 → 01/04/26 | Oui (tout à 0) | Non visibles |
| Angers (ALR) | 01/04/26 → 01/04/26 | Oui (tout à 0) | Non visibles |
| Châteaudun (CLR) | 01/03/26 → 31/03/26 | Non (encore mars) | 6 vendeurs (mars) |
| Cholet | 01/04/26 → 01/04/26 | Oui (tout à 0) | Non visibles |
| Romorantin (RLR) | 01/03/26 → 31/03/26 | Non (encore mars) | 5 vendeurs (mars) |
| Vendôme (VLR) | 01/04/26 → 01/04/26 | Oui (tout à 0) | Non visibles |

**Analyse** : C'est le comportement normal du premier jour du mois à 6h du matin. La plupart des boutiques n'ont pas encore enregistré de ventes pour avril. Romorantin et Châteaudun affichent encore les données de mars (le système 3GWIN n'a pas encore basculé).

## Données préparées

Un fichier CSV et JSON ont été générés avec les 16 vendeurs du Groupe Garcia, initialisés à 0 pour avril 2026 avec les jours travaillés individuels (RAF) corrects :

- `donnees_commissions_update_20260401.csv`
- `donnees_commissions_update_20260401.json`

Jours ouvrés avril 2026 : **1/21** (jour 1 sur 21)

## Problème rencontré : mise à jour Sheet impossible

L'accès au Google Sheet `1su6J88rzRF9hnZXwOsD8gkSDQpDl_XI1Ifjcoost6rY` nécessite une authentification Google. Chrome n'a pas pu créer de groupe d'onglets (erreur : "Tabs can only be moved to and from normal windows"), empêchant la navigation vers le Sheet.

## Action recommandée

Le script **SyncMobPlace.gs** (déjà déployé dans Google Apps Script avec un trigger horaire) devrait effectuer la même mise à jour automatiquement. Il utilise `UrlFetchApp.fetch()` depuis les serveurs Google pour accéder aux pages 3GWIN et écrire dans le Sheet.

Si la synchronisation automatique ne fonctionne pas, les données CSV/JSON préparées peuvent être importées manuellement dans le Google Sheet.

## Prochaine exécution

Les données 3GWIN devraient commencer à se remplir dans la journée au fur et à mesure des ventes. La prochaine exécution de cette tâche planifiée devrait pouvoir récupérer des données non-nulles.
