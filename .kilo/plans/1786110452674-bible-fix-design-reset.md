# Plan : Réparer le préchargement Bible + Reprise design à zéro

## Objectif
1. Corriger le téléchargement/stockage Bible qui échoue systématiquement sur `expo-sqlite` Android (`NullPointerException`).
2. Reprendre le design mobile à zéro, pas seulement tokeniser l’existant.

## Contexte
- Le mobile est une app Expo/React Native avec `expo-sqlite` et `expo-file-system`.
- Le backend `dryApi` tourne déjà en `npm run dev`.
- Le bundler Expo est prêt et l’app est lanceable, mais le design actuel ne correspond pas à la demande de reprise à zéro.
- Les logs montrent des échecs `NativeDatabase.execAsync` rejetés côté Android/NativeDatabase.

## Décisions prises
- **Bible** : ne pas rester sur un patch réseau. Le problème vient de SQLite/`expo-sqlite`, donc la correction doit se faire dans la couche base de données et le preloader.
- **Design** : faire une vérification complète de la direction design actuelle, puis proposer une nouvelle direction UI (composition visuelle, typographie, fonds, cartes, états) avant de l’appliquer écran par écran.
- **Ordre** : réparer Bible d’abord, car c’est fonctionnel et visible par l’utilisateur ; le redesign peut ensuite être fait sans risque de casser un téléchargement déjà en cours.

## Étapes

### 1. Audit SQLite / `expo-sqlite`
- Lire `src/services/db/database.ts`, `src/services/db/bibleRepository.ts`, `src/services/bible/biblePreloader.ts`.
- Vérifier la config native `expo-sqlite` dans `app.json` / `package.json` / `tsconfig`.
- Reproduire/confirmer la cause exacte du `NullPointerException` côté preloader.

### 2. Correction du stockage Bible
- Option A : migrer le schéma SQLite pour supprimer le blocage `execAsync` si possible.
- Option B : ajouter une couche de réparation automatique de la DB quand `NullPointerException` est détecté.
- Option C : si `expo-sqlite` est instable sur ce chemin, basculer le stockage Bible vers un mécanisme plus fiable tout en gardant la lecture hors-ligne.
- Garantir que le preloader :
  - ne perd pas la DB en cours de route,
  - préserve les chapitres déjà téléchargés,
  - retente proprement les chapitres échoués.

### 3. Vérification du preloader
- Tester le flux `startBiblePreload` après correction :
  - lecture du cache existant,
  - téléchargement par lots,
  - écriture sécurisée,
  - marquage `completed` / gestion d’erreur.

### 4. Reprise design à zéro
- Établir une nouvelle baseline design :
  - structure de navigation et layout global,
  - cartes et conteneurs,
  - typographie et hiérarchie,
  - fonds et textures,
  - composants réutilisables et variations,
  - états chargement / vide / erreur.
- Appliquer cette baseline écran par écran, en commençant par Home et Bible.

### 5. Validation
- Lancer l’app mobile et vérifier :
  - le téléchargement Bible réussit sans crash SQLite,
  - le design est bien appliqué et lisible sur device,
  - la navigation et les retours sont cohérents.

## Risques
- `expo-sqlite` sur Android peut nécessiter une montée de version ou une config native complémentaire.
- Une reprise design complète peut casser temporairement des écrans ; prévoir des commits/palier par écran.

## Hors périmètre
- Backend `dryApi` : déjà fonctionnel, pas de modification prévue dans ce plan.
- Mode web : pas demandé.
