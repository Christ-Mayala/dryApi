# DRY API Framework

Framework Node.js multi-tenant pour construire des APIs metier a partir d'un noyau commun, tout en gardant chaque application cliente isolee dans `dryApp/`.

## Ce que fait DRY

- Noyau commun dans `dry/` pour la securite, les middlewares, les factories, le cache, la documentation et le monitoring.
- Couche metier dans `dryApp/` pour les tenants et leurs features.
- Bootstrap unique qui monte toutes les apps detectees sous `/api/v1/<app>`.
- Documentation Swagger, scripts de maintenance, health checks et tests integres.

## Ce qui est core vs optionnel

Le core obligatoire:

- Express, MongoDB, bootloader multi-tenant
- auth JWT, middlewares de securite, gestion d'erreurs
- `routerFactory`, `crudFactory`, conventions de features
- health checks et documentation Swagger

Les modules optionnels:

- Redis pour le cache
- Cloudinary pour les medias
- Stripe pour les paiements
- Socket.IO pour les notifications
- OAuth Google/Facebook
- outils media et scraping

L'objectif est de garder le noyau lisible et stable, puis d'activer les integrations seulement quand une app en a besoin.

## Apps vitrine

- `SCIM`: cas d'usage reservation + notifications + administration.
- `SkillForge`: cas d'usage catalogue, commandes, paiement et export.
- `MediaDL`: cas d'usage media pipeline et traitements de fichiers.

## Demarrage en 10 minutes

1. Installer les dependances

```bash
npm install
```

2. Initialiser l'environnement

```bash
cp .env.example .env
```

3. Renseigner au minimum ces variables dans `.env`

- `MONGO_URI`
- `JWT_SECRET`
- `SESSION_SECRET`

4. Lancer le serveur

```bash
npm run dev
```

5. Verifier que tout repond

- health: [http://localhost:5000/health/ready](http://localhost:5000/health/ready)
- swagger: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

6. Lancer les checks de base

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:smoke
```

## Documentation

- [Demarrage rapide](./docs/01_GETTING_STARTED.md)
- [Guide developpeur](./docs/02_DEVELOPER_GUIDE.md)
- [Architecture](./docs/03_ARCHITECTURE.md)
- [Guide de test](./docs/04_TESTING_GUIDE.md)
- [Reference API](./docs/05_API_REFERENCE.md)
- [Deploiement](./docs/06_DEPLOYMENT.md)
- [Reference commandes](./docs/07_COMMANDS_REFERENCE.md)
- [Conventions kernel vs app](./docs/08_KERNEL_BOUNDARIES.md)
- [Scope produit et apps vitrine](./docs/09_PRODUCT_SCOPE.md)

## Structure rapide

```text
config/        configuration centralisee et validation runtime
dry/           noyau framework
dryApp/        applications clientes et features metier
docs/          documentation du framework
scripts/       utilitaires, generation, maintenance, tests
tests/         suites unit, integration et e2e
```

## Qualite et automatisation

- lint et format avec ESLint + Prettier
- hooks de commit avec Husky
- couverture du noyau avec `c8`
- CI GitHub Actions avec MongoDB de test

## Note securite

Les secrets previously presents dans `.env` ont ete neutralises dans ce repo. Ils doivent etre regeneres avant tout usage reel en local, en preview ou en production.
