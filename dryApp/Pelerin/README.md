# Pelerin

Tenant backend de l'application mobile **Le Pèlerin — Du monde vers la Croix**
(`../../Le Pèlerin — Du monde vers la Croix/`), un compagnon spirituel chrétien open source.

Suit les conventions standard du framework `dry` : modèles Mongoose bruts compilés via
`req.getModel`, réponses `{ success, message, data }`, soft delete (`status: 'deleted'`),
authentification via `dry/modules/user` (JWT + OAuth Google/Facebook déjà génériques).

## Démarrage express
1. Installe les dépendances du repo `dryApi` : `npm install`
2. Crée `.env` à partir de `.env.example` (`MONGO_URI`, `JWT_SECRET`, …)
3. Démarre le serveur : `npm run dev`
4. Seed des données de référence (66 livres bibliques) : `npm run seed`
5. Doc Swagger : `http://localhost:5000/api-docs`

## Endpoints principaux
- `/api/v1/pelerin/user/*` — auth (login, register, refresh, profil) — module `dry` générique
- `/api/v1/pelerin/bibleBook` — référence des 66 livres bibliques (lecture publique)
- `/api/v1/pelerin/bible` — versets (lecture publique, écriture admin)
- `/api/v1/pelerin/bible/chapter?version=&bookCode=&chapter=` — lire un chapitre complet
- `/api/v1/pelerin/bible/search?q=&version=` — recherche plein texte
- `/api/v1/pelerin/bibleAnnotation` — favoris/surlignage/réflexion personnelle par verset (privé, JWT requis)
- `/api/v1/pelerin/notes` — bloc-notes spirituel façon Notion, documents/dossiers (privé, JWT requis)
- `/api/v1/pelerin/parcours` — parcours spirituels (définition, lecture publique, écriture admin)
- `/api/v1/pelerin/parcoursProgress` — ma progression sur les parcours (privé, JWT requis)
- `/api/v1/pelerin/meditation` — méditations quotidiennes (lecture publique, écriture admin)
- `/api/v1/pelerin/meditationLog` — mon historique de ressenti (privé, JWT requis)
- `/api/v1/pelerin/devPersonnel` — bibliothèque de développement personnel par thème (lecture publique)
- `/api/v1/pelerin/temoignage` — témoignages (lecture publique si approuvé ; `/mine` et `/pending` privés)
- `/api/v1/pelerin/quiz` — questions bibliques (lecture publique sans la réponse), `/:id/answer` (soumettre), `/stats` (mes stats, privé)
- `/api/v1/pelerin/audioTrack` — contenus audio chrétiens, liens externes uniquement (lecture publique, écriture admin)
- `/api/v1/pelerin/habit` — mes habitudes spirituelles avec streak calculé (privé, JWT requis)
- `/api/v1/pelerin/habitLog` — historique/coche quotidienne d'une habitude (privé, JWT requis)

Reste à venir : synchronisation offline-first — voir la feuille de route de l'app mobile
(`../../Le Pèlerin — Du monde vers la Croix/docs/ROADMAP.md`).

## Feature `bible`
Modèle `BibleVerse` : `version` (`LSG1910` | `DARBY` | `KJV`), `bookCode` (identifiant stable
inter-versions, ex. `jean`), `book` (nom affiché dans la langue de la version), `testament`
(`AT`/`NT`), `chapter`, `verse`, `text`.

- `GET /api/v1/pelerin/bible?version=LSG1910&bookCode=jean&chapter=3` — liste paginée/filtrable
- `GET /api/v1/pelerin/bible/chapter?version=LSG1910&bookCode=jean&chapter=3` — chapitre complet trié
- `GET /api/v1/pelerin/bible/search?q=amour&version=LSG1910` — recherche plein texte
- `GET/POST/PUT/DELETE /api/v1/pelerin/bible/:id` — CRUD standard (écriture admin uniquement)

Le texte des 3 versions n'est **pas** inclus dans `seed.js` (trop volumineux). Il s'importe via
un script dédié et idempotent :

```
npm run seed:pelerin-bible
```

(`scripts/seed/seed-pelerin-bible.js`, hors racine `dryApp` — ne touche jamais un autre tenant
que `Pelerin`). Le script télécharge (avec cache local dans `scripts/seed/data/pelerin-bible/`,
ignoré par git) puis importe :

- **LSG1910** — Louis Segond (1910), français
- **DARBY** — Bible J.N. Darby, français (édition 1885, révisée)
- **KJV** — King James Version (1769), anglais

Source des données : dumps JSON complets du projet [getbible/v2](https://github.com/getbible/v2)
(`https://api.getbible.net/v2/ls1910.json`, `.../darby.json`, `.../kjv.json`). Ce sont 3
traductions du domaine public (traducteurs décédés depuis plus d'un siècle) ; voir les métadonnées
de chaque traduction dans `translations.json` du dépôt getbible/v2 pour le détail de leur statut.
Le mapping livre/verset se fait par **position** dans les 66 livres (1er livre = Genèse, ordre
canonique standard), en réutilisant telle quelle la référence `BIBLE_BOOKS` exportée par
`seed.js`.

Import par lots de 2000 documents (`insertMany`, `ordered:false`), doublons ignorés proprement
grâce à l'index unique `{version,bookCode,chapter,verse}` (relancer le script est donc sans
risque). Comptes obtenus lors de l'import initial : LSG1910 = 31 170 versets, DARBY = 31 167
versets, KJV = 31 102 versets (66 livres / 1189 chapitres chacun).

**Écart de versification connu (DARBY uniquement)** : la traduction Darby française suit le
découpage hébraïque traditionnel pour 2 livres, ce qui diffère du découpage utilisé par
`BibleBook.chapterCount` (aligné sur LSG1910/KJV) : Joël a 4 chapitres en DARBY (vs 3 pour
LSG1910/KJV) et Malachie a 3 chapitres en DARBY (vs 4 pour LSG1910/KJV). Le nombre total de
versets reste correct ; seule la numérotation des chapitres de ces 2 livres diffère selon la
version consultée.

## Feature `bibleBook`
Modèle `BibleBook` : référence statique des 66 livres (canon protestant, cohérent avec les 3
versions ci-dessus), seedée par `seed.js`. CRUD standard via `buildCrudRouter` — lecture publique,
écriture admin.

## Feature `bibleAnnotation`
Un document par (utilisateur, version, livre, chapitre, verset) portant `isFavorite`,
`highlightColor` (`gold`/`green`/`rose`/`sky`) et `note` (réflexion personnelle). Upsert via
`POST /bibleAnnotation`. Toujours filtré par `createdBy` — jamais de lecture croisée entre users.

## Feature `notes`
Bloc-notes spirituel façon Notion : collection `Notes` auto-référencée (`parentId`) pour les
dossiers/documents, avec `links` (référence souple vers un verset, un parcours, une méditation ou
un objectif). 100% privé (`createdBy`). Recherche plein texte via `GET /notes/search?q=`.

## Feature `parcours` / `parcoursProgress`
`Parcours` : contenu éditorial (titre, description, étapes avec lecture/méditation/question de
réflexion/exercice pratique) — lecture publique, écriture admin. `ParcoursProgress` : progression
personnelle par utilisateur (`completedSteps`, `currentStepOrder`), un document par
(utilisateur, parcours), avancée via `POST /parcoursProgress/:parcoursId/complete-step`.
