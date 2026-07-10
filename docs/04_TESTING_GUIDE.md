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
détectée dans `dryApp/`. Certains de ces seeders sont **destructeurs** (ex:
`dryApp/SCIM/seed.js` fait `deleteMany({})` sur plusieurs collections avant de
reseeder). Si ces scripts se connectent au cluster MongoDB Atlas de production
(celui de `.env`), ils peuvent **vider et réécraser de vraies données**.

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
