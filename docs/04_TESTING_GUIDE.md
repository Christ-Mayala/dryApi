# Guide de test

<!-- nav:start -->

[⬅ Précédent : 03 · Architecture](./03_ARCHITECTURE.md) · **04 · Testing Guide** · [Suivant : 05 · API Reference ➡](./05_API_REFERENCE.md)

<!-- nav:end -->

Les tests sont maintenant separes par niveau:

```text
tests/
  unit/         noyau DRY, middlewares, bootstrap, config
  integration/  routes et features applicatives
  e2e/          parcours complets reserves aux scenarios bout en bout
```

## Commandes

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:smoke
npm run coverage
```

## ⚠️ Isolation de la base de données — lire avant de lancer test:integration/e2e/smoke

`test:unit` ne touche à aucune base (logique pure, pas de connexion Mongo — voir
`jest.config.js` / `jest.setup.js`).

`test:integration`, `test:e2e` et `test:smoke` en revanche démarrent un vrai serveur
et lancent `scripts/seed/seed-all.js`, qui appelle le `seed.js` de **chaque app**
détectée dans `dryApp/`.

**Convention seed : `seed.js` doit toujours être additif, jamais destructeur.** Chaque `seed.js` doit vérifier si ses données existent déjà
(upsert par clé naturelle, ou skip si une collection cible a déjà des documents) et
ne jamais faire `deleteMany({})`/`drop()` sur des données potentiellement réelles.
`dryApp/SCIM/seed.js` (autrefois l'exemple destructeur de référence : `deleteMany({})`
sur Property/Reservation/Message avant reseed) a été corrigé en ce sens — il détecte
maintenant des biens déjà présents et ignore tout le bloc biens/réservations/
messages/favoris plutôt que de l'écraser. Si tu ajoutes un nouveau `seed.js`, suis
le même principe.

Pour repartir d'une base de démo vierge **volontairement**, une commande distincte et
explicite existe : `npm run seed:reset` (supprime uniquement les documents que le
seed a lui-même créés, via `scripts/seed/seed-clean.js` qui s'appuie sur le journal
`__seed_logs`, puis relance `seed-all.js`). `npm run seed:clean` supprime sans
reseeder. **`npm run seed` seul ne supprime plus jamais rien.**

Pour éviter ça : `scripts/tests/loadTestEnv.js` (utilisé par `run-integration.js`
et `smoke-runner.js`) charge `.env.test` en priorité — copier
`.env.test.example` vers `.env.test` et pointer `MONGO_URI_TEST` vers une base
**isolée** (MongoDB local ou cluster/projet Atlas séparé, jamais celui de
production). **Sans `.env.test`, un avertissement s'affiche et les tests
retombent sur `.env` (production)** — ne pas ignorer cet avertissement.

Avant de lancer `test:integration`/`test:e2e`/`test:smoke`, vérifier que
`.env.test` existe et pointe vers une base de test.

### Pourquoi les clés sont suffixées `_TEST`

`config/database.js` résout chaque variable via `readSetting(name)`, qui
regarde d'abord `NOM_TEST` quand `NODE_ENV=test` (`NOM_DEV` en développement),
puis retombe sur `NOM` tout court, puis sur une valeur par défaut. C'est ce
mécanisme — pas un fichier séparé — qui isole vraiment la config : `.env.test`
n'est qu'un moyen pratique de définir ces clés `_TEST` localement. C'est la
même convention que dans `.github/workflows/ci.yml` (`MONGO_URI_TEST`,
`JWT_SECRET_TEST`, etc.), qui isole automatiquement les tests en CI via un
conteneur `mongo:7` éphémère.

## Regles recommandees

- toute modification dans `dry/` doit ajouter ou ajuster un test unitaire
- toute nouvelle feature dans `dryApp/` doit avoir au moins un test d'integration
- les tests e2e doivent rester limites a quelques parcours critiques

## Ce qui est deja couvert

- validation runtime de la configuration
- bootstrap HTTP et CORS
- auth middleware
- cache middleware
- router factory
- cache de connexions tenant

## Objectif de couverture

La couverture prioritaire doit porter sur `dry/` et `config/`, car c'est le moteur commun du framework.

<!-- nav:start -->

[⬅ Précédent : 03 · Architecture](./03_ARCHITECTURE.md) · **04 · Testing Guide** · [Suivant : 05 · API Reference ➡](./05_API_REFERENCE.md)

<!-- nav:end -->
