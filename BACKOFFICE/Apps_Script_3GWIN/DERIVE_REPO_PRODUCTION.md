# Dérive repo / production — Apps Script « Dashboard Manager Groupe Garcia »

Projet : `1cgsh8C0BLzAD39nSYPgoj_xaled3g5jEPkwbnjHHa_FH8TD3j3xc34v8`

Depuis la resynchronisation du **09/09/2026**, les fichiers de ce dossier sont un
**miroir exact de ce qui tourne réellement en production** (contenu vérifié par
empreinte SHA-256 contre les modèles de l'éditeur Apps Script).

| Fichier | Lignes en production |
|---|---|
| `MAJ_Dashboard_Jour.gs` | 1203 |
| `MAJ_3GWIN_Autonome.gs` | 888 |
| `Declencheur_DILAX.gs` | 87 |
| `Code.gs` | 54 |
| `Index.html` | 635 |

`Code.gs` et `Index.html` n'avaient **jamais** été sauvegardés dans le repo.

## Code présent dans l'historique du repo mais ABSENT de la production

La resynchronisation a révélé que la dérive était **bidirectionnelle** : certaines
évolutions committées ici n'ont jamais été déployées dans l'éditeur Apps Script.
Elles restent récupérables dans l'historique git.

### 1. `Declencheur_DILAX.gs` — déclencheur Goodays non déployé

Les fonctions `declencherGoodays()` et `installerTriggerGoodays()` (commit
`1df36415`, 11/07/2026) **n'existent pas en production**. La cadence Goodays
repose donc toujours sur le cron GitHub de `maj-goodays.yml`, qui partait avec
2 à 4 h de retard — c'était précisément le problème que ce commit voulait corriger.

Récupérer le code :

```bash
git show 1df36415:BACKOFFICE/Apps_Script_3GWIN/Declencheur_DILAX.gs
```

### 2. `MAJ_3GWIN_Autonome.gs` — refonte des gardes non déployée

Le commit `d96e1c24` (01/08/2026, « gardes anti-publication figée et colonne
vendeur cassée ») introduit les helpers `periodeEstMoisCourant_()` et
`colonneVendeurInvalide_()`. **Aucun des deux n'est en production.**

La production implémente une garde équivalente mais d'une autre génération :
détection inline de l'en-tête de publication par expression régulière
(`Publication perimee ignoree`, `vue perimee`) et filtre `Vendeur fantome ignore`,
ce dernier étant lui-même absent du repo avant le 09/09.

Récupérer le code :

```bash
git show d96e1c24:BACKOFFICE/Apps_Script_3GWIN/MAJ_3GWIN_Autonome.gs
```

### 3. `MAJ_Dashboard_Jour.gs` — production en avance

Ici c'est l'inverse : la production était en avance de ~140 lignes. Fonctions
qui n'étaient pas sauvegardées : `envoyerEmailsGagnantsJour`,
`installerTriggerEmailsGagnants20h`, `supprimerTriggerEmailsGagnants`,
`primeJourMontant_`. La production porte aussi la mise à jour `EXCLUS_TOP3` du
01/09/2026 (fin des challenges boutique Amboise/Cholet).

Aucune fonction n'a été perdue sur ce fichier : les correctifs ponctuels
(`corrigerChallenges_20260711`, `corrigerAngers_juin2026`, `annulerRomain_20260711`,
`debugPagesJour`, `nettoyerDoublonsChallenges`, `corrigerLigne21Avril`) sont bien
présents en production. Seules des constantes de challenge périmées ont été
remplacées par leur version courante (`amboise_won` / `louane_won`, seuil groupe).
État antérieur : `git show 34409ef5:BACKOFFICE/Apps_Script_3GWIN/MAJ_Dashboard_Jour.gs`.

## Point vérifié

Les 15 liens 3GWIN distincts sont **identiques** entre repo et production : le
workflow de surveillance « Contrôle liens 3GWIN »
(`scripts/controle_liens_3gwin.py`) reste fiable.

## Rappel de méthode

L'éditeur Apps Script ne se laisse ni exporter par API (endpoint `feeds/download/export`
en 403) ni lire par requête sortante. La resynchronisation se fait en ouvrant chaque
fichier dans l'éditeur puis Ctrl+A / Ctrl+C, et en vérifiant systématiquement le
SHA-256 du texte récupéré contre `monaco.editor.getModels()`.
