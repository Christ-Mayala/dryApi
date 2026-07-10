<!-- nav:start -->

[⬅ Retour à la doc](../README.md) · **00 · Cartographie du projet** · [Suivant : 01 · Getting Started ➡](./01_GETTING_STARTED.md)

<!-- nav:end -->

# 🗺️ Cartographie complète du projet DRY API

Ce document explique **ce que fait chaque dossier et chaque fichier important** du repo, sans avoir besoin d'ouvrir le code. Objectif : pouvoir répondre à "où est-ce que ça se passe ?" en 30 secondes.

Pour le _pourquoi_ de l'architecture (multi-tenant, kernel DRY), voir [03_ARCHITECTURE.md](./03_ARCHITECTURE.md). Ce document-ci est plus terre-à-terre : un inventaire.

---

## 1. Vue d'ensemble en une phrase

**DRY API** est un framework Node.js/Express **multi-tenant** : un seul serveur, une seule codebase noyau (`dry/`), qui sert plusieurs applications indépendantes (`dryApp/*`) — chacune avec sa propre base de données MongoDB, ses propres routes, mais qui réutilisent toutes le même moteur (auth, CRUD, cache, audit, sécurité, etc.).

```
Requête → /api/v1/<nomApp>/<feature>/...
              │
              ▼
     dry/bootstrap/routes.js charge dynamiquement
     le tenant "<nomApp>" et monte ses features
              │
              ▼
     dryApp/<NomApp>/features/<feature>/route/*.routes.js
              │
              ▼
     dryApp/<NomApp>/features/<feature>/controller/*.js
              │
              ▼
     Modèle Mongoose compilé pour LA base de CE tenant (dry/core/factories/modelFactory.js)
```

---

## 2. Racine du projet

| Élément                            | Rôle                                                                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.js`                        | Point d'entrée. Lance `createApp()` (dry/bootstrap/http.js) puis écoute sur `PORT`.                                                                                                                                               |
| `package.json`                     | Dépendances + tous les scripts `npm run ...` (voir [07_COMMANDS_REFERENCE.md](./07_COMMANDS_REFERENCE.md)).                                                                                                                       |
| `.env` / `.env.example`            | Config réelle (jamais commit) / gabarit à copier.                                                                                                                                                                                 |
| `.env.test` / `.env.test.example`  | Config isolée pour `test:integration`/`e2e`/`smoke` — voir [04_TESTING_GUIDE.md](./04_TESTING_GUIDE.md). **Ne jamais y mettre le cluster de prod.**                                                                               |
| `.gitignore`                       | Exclut `node_modules`, logs, uploads, `frontend/`, `generated/` (sorties de générateurs, reproductibles), les configs d'outils perso (`.idea/`, `.continue/`, etc.).                                                              |
| `config/database.js`               | **Le seul point de vérité de la config.** Lit `process.env`, valide (JWT_SECRET ≥ 32 car., etc.), résout les suffixes `_DEV`/`_TEST` par environnement. Tout le reste du code lit `config.XXX`, jamais `process.env` directement. |
| `dry/`                             | Le noyau du framework — voir section 3.                                                                                                                                                                                           |
| `dryApp/`                          | Les applications tenant — voir section 4.                                                                                                                                                                                         |
| `scripts/`                         | Tous les outils CLI (générateurs, seeders, tests, swagger, maintenance) — voir section 5.                                                                                                                                         |
| `tests/`                           | `unit/` (logique pure, pas de DB), `integration/` (une suite par app), `e2e/` (vide actuellement).                                                                                                                                |
| `docs/`                            | Cette documentation.                                                                                                                                                                                                              |
| `migrations/`                      | Scripts de migration Mongo versionnés (`001-...js`, `002-...js`), exécutés via `npm run migrate:up`.                                                                                                                              |
| `k8s/`                             | Manifests Kubernetes complets (namespace, deployment, service, ingress, hpa, configmap, secret).                                                                                                                                  |
| `monitoring/`                      | Dashboard Grafana JSON prêt à l'emploi (`monitoring/grafana/`).                                                                                                                                                                   |
| `nginx/`                           | Config nginx de reverse proxy pour un déploiement Docker/VM classique.                                                                                                                                                            |
| `landing/`                         | Pages HTML statiques publiques, servies directement par `dry/bootstrap/http.js` (`express.static`) : page d'accueil, `/pricing`, et `/trivida/privacy` (politique de confidentialité Trivida, requise par Google Play).           |
| `logs/`                            | Sortie des deux systèmes de logs (voir section 6). Gitignoré.                                                                                                                                                                     |
| `uploads/`, `downloads/`           | Dossiers de travail (upload temporaire, téléchargements média) — vides par défaut, gitignorés.                                                                                                                                    |
| `Dockerfile`, `docker-compose.yml` | Build et orchestration locale (app + Mongo + Redis + nginx).                                                                                                                                                                      |
| `.github/workflows/ci.yml`         | CI GitHub Actions : lint, format, tests unit/intégration/smoke contre un Mongo éphémère.                                                                                                                                          |
| `.husky/pre-commit`                | Hook git : lance lint + tests unitaires avant chaque commit local.                                                                                                                                                                |
| `CHANGELOG.md`                     | Historique des versions (Keep a Changelog / SemVer).                                                                                                                                                                              |
| `jest.config.js` / `jest.setup.js` | Config Jest pour `test:unit` — env hermétique, aucune connexion réseau/DB.                                                                                                                                                        |

### Fichiers legacy identifiés (à connaître, pas forcément à supprimer)

| Fichier                                 | Statut                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dry/config/connection/db.js`           | **Mort** — ancienne connexion Mongo simple (non multi-tenant), remplacée par `dbConnection.js`. Aucune référence nulle part dans le code.              |
| `dry/core/application/dynamicRouter.js` | **Mort** — ancien chargeur de routes, remplacé par `dry/core/application/bootloader.js`. Aucune référence nulle part.                                  |
| `dry/utils/auth/jwt.js`                 | **Doublon** de `jwt.util.js` — encore utilisé par les contrôleurs `users.*` de SCIM uniquement. Le reste du code (dont Trivida) utilise `jwt.util.js`. |

---

## 3. `dry/` — le noyau du framework

Tout ce qui est ici est **partagé par toutes les apps**. Une modification dans `dry/` impacte Trivida, SCIM, FreeLLM, etc. en même temps — c'est le code le plus sensible du repo (voir [08_KERNEL_BOUNDARIES.md](./08_KERNEL_BOUNDARIES.md) pour les règles de modification).

### `dry/bootstrap/` — démarrage du serveur

| Fichier               | Rôle                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http.js`             | Construit l'app Express : compression, session, cookies, body-parser, CORS, logging (morgan + logs custom avec body masqué), sécurité (helmet, rate-limit), pages statiques `landing/`. |
| `routes.js`           | Appelle `bootloader.js` pour monter toutes les apps, branche le gestionnaire d'erreurs global et les routes `/health`, `/system/status`.                                                |
| `socket.js`           | Serveur Socket.IO (notifications temps réel), authentifié par JWT.                                                                                                                      |
| `health-monitor.js`   | Boucle périodique qui vérifie la santé du système et envoie des alertes (email/Slack/Discord/webhook) si `HEALTH_MONITOR_INTERVAL_MS` est configuré.                                    |
| `process-handlers.js` | Gère les crashs (`uncaughtException`, `unhandledRejection`) : log, alerte, arrêt propre ou non selon `CRASH_ON_UNHANDLED_REJECTION`.                                                    |
| `startup-banner.js`   | Le bandeau ASCII affiché au démarrage avec la liste des endpoints disponibles.                                                                                                          |

### `dry/core/` — le cœur du multi-tenant

| Fichier                      | Rôle                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application/bootloader.js`  | **Le plus important du repo.** Scanne `dryApp/`, connecte chaque tenant à sa DB, injecte `req.getModel`/`req.appName`, monte les routes de chaque feature trouvée dans `dryApp/<App>/features/*/route/*.routes.js` sur `/api/v1/<app>`. |
| `application/appScanner.js`  | Utilitaire : liste les noms d'apps présentes dans `dryApp/`.                                                                                                                                                                            |
| `factories/modelFactory.js`  | Compile (et met en cache) un modèle Mongoose pour un couple (tenant, nom de modèle) — c'est ce qui rend un même schéma réutilisable sur N bases différentes.                                                                            |
| `factories/crudFactory.js`   | Génère des handlers CRUD (list/get/create/update/delete) standardisés à partir d'un modèle — utilisé par `create-app.js` pour générer les contrôleurs.                                                                                  |
| `factories/routerFactory.js` | Construit un routeur Express complet (routes + middlewares) à partir d'une config de feature.                                                                                                                                           |
| `plugins/mongoose.plugin.js` | Plugin Mongoose global : ajoute `slug`, soft-delete, timestamps, log automatique sur chaque schéma qui l'utilise.                                                                                                                       |
| `plugins/passport.plugin.js` | Configure Passport (Google/Facebook OAuth), multi-tenant.                                                                                                                                                                               |

### `dry/middlewares/` — la chaîne de traitement des requêtes

| Fichier                                        | Rôle                                                                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protection/security.middleware.js`            | Helmet, rate-limiting global, sanitization NoSQL.                                                                                                                                  |
| `protection/auth.middleware.js`                | Vérifie le JWT (`protect`), attache `req.user`.                                                                                                                                    |
| `protection/authRateLimit.js`                  | Rate-limit spécifique login/register (anti-bruteforce).                                                                                                                            |
| `protection/csrf.middleware.js`                | Protection CSRF (`csurf`) pour les routes qui en ont besoin.                                                                                                                       |
| `apiKey/apiKey.middleware.js`                  | Valide une clé API (header `x-api-key`) via `dry/services/auth/apiKey.service.js`. Opt-in : à ajouter sur les routes qui doivent accepter une clé API en plus/à la place d'un JWT. |
| `audit/audit.middleware.js` + `audit/index.js` | `withAudit('NOM_ACTION')` — enregistre qui a fait quoi, avec masquage des champs sensibles.                                                                                        |
| `cache/cache.middleware.js`                    | Cache Redis des réponses GET (si Redis actif).                                                                                                                                     |
| `query/queryBuilder.js`                        | Pagination, tri, filtres avancés (`?price[gt]=100`) sur les routes `GET /` — voir [05_API_REFERENCE.md](./05_API_REFERENCE.md).                                                    |
| `validation/validation.middleware.js`          | Validation Joi générique pour les routes d'auth.                                                                                                                                   |
| `error/errorHandler.js`                        | Gestionnaire d'erreurs global : formate la réponse, masque les messages techniques en prod, envoie une alerte si critique.                                                         |
| `inputValidation.middleware.js`                | Détecte/nettoie XSS et injections NoSQL/SQL sur toutes les requêtes entrantes.                                                                                                     |
| `apiVersion.middleware.js`                     | Ajoute les headers `API-Version`/`API-Deprecated`/`API-Sunset`.                                                                                                                    |
| `performanceMonitor.middleware.js`             | Mesure temps de réponse/mémoire, détecte les endpoints lents.                                                                                                                      |
| `rateLimiterEnhanced.middleware.js`            | Rate-limit générique configurable (fenêtre, multiplicateurs admin/authentifié).                                                                                                    |
| `requestId.middleware.js`                      | Génère un `req.requestId` unique, utilisé dans tous les logs pour tracer une requête de bout en bout.                                                                              |
| `maintenance.middleware.js`                    | Bloque les requêtes non-admin si le système est en mode maintenance.                                                                                                               |

### `dry/modules/` — modules natifs montés pour toutes les apps

Chargés automatiquement sur `/api/v1/<nom-du-dossier>` (voir `dry/bootstrap/routes.js`) :
| Dossier | Monté sur | Rôle |
|---|---|---|
| `user/` | Multi-tenant, injecté par chaque app (pas de montage direct) | Le kernel d'authentification (login, register, refresh, profil, mot de passe, reset) réutilisé par toutes les apps — voir `auth.controller.js`. |
| `billing/` | `/api/v1/billing` | Abonnements et paiements Stripe. |
| `licensing/` | `/api/v1/licensing` | Génération/validation de licences et clés API. |
| `senepay/` (racine `dry/modules/senepay`) | `/api/v1/senepay` | Paiements Mobile Money via l'agrégateur SenePay (14 pays africains) — utilisé par Trivida. |
| `apiKeys/apiKeys.routes.js` | `/api/v1/apikeys` | CRUD des clés API de l'utilisateur connecté (create/list/revoke/rotate/update) — voir `dry/services/auth/apiKey.service.js`. |
| `audit/audit.routes.js` | `/api/v1/audit` | Consultation de la piste d'audit, réservé aux admins (`GET /logs`, `GET /logs/:id`). |
| `auth/auth.routes.js` | `/api/auth` (social) | Routes OAuth sociales génériques (Google commenté, voir `docs/REACTIVER_GOOGLE_OAUTH.md`). |
| `log/log.schema.js` | — | Schéma utilisé par le plugin Mongoose pour l'historique des modifications. |

> Les modules montés globalement (billing, licensing, senepay, apiKeys, audit) n'ont `req.getModel`/`req.appName` injecté que s'ils sont explicitement enveloppés (voir `injectTrivida` dans `dry/bootstrap/routes.js`) — sinon ils retombent sur le tenant `'Trivida'` par défaut (limitation connue, pas spécifique à un module).

### `dry/services/` — logique métier transverse

| Dossier                            | Rôle                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alert/`                           | Envoie des alertes (email/Slack/Discord/webhook) sur erreurs critiques, avec dédoublonnage et masquage de données sensibles.                                      |
| `auth/`                            | `apiKey.service.js` (génération/hachage SHA-256/validation des clés API), emails transactionnels (Brevo), reset de mot de passe, validation des tenants.          |
| `cache/redis.service.js`           | Client Redis partagé (no-op si `REDIS_ENABLED=false`).                                                                                                            |
| `cleanup/`                         | Purge des documents soft-deleted (cron), expiration des "bons plans" SCIM.                                                                                        |
| `cloudinary/cloudinary.service.js` | Upload d'images/fichiers vers Cloudinary (avatars, etc.).                                                                                                         |
| `export/export.service.js`         | Conversion JSON → CSV.                                                                                                                                            |
| `health/health.service.js`         | Vérifie DB, Redis, disque, apps actives — alimente `/health/ready` et `/system/status`.                                                                           |
| `media/`                           | Téléchargement multi-plateforme (pour MediaDL) et suivi de jobs asynchrones.                                                                                      |
| `notification/`                    | Notifications temps réel (Socket.IO) + rappels de réservation SCIM (cron).                                                                                        |
| `payment/`                         | `payment.factory.js` choisit le bon provider (`providers/`: CinetPay, Stripe, Moneroo, Airtel, MTN, SenePay) derrière une interface commune (`base.provider.js`). |
| `system/system-actions.service.js` | Actions admin : créer une nouvelle app via le générateur, depuis l'interface `/system/status`.                                                                    |

### `dry/utils/` — fonctions utilitaires pures

| Dossier                         | Rôle                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/jwt.util.js`              | Signature/vérification des tokens JWT (access + refresh), hachage des refresh tokens.                                                                                                         |
| `data/`                         | `pagination.js` (calcul page/limit/skip), `parse.js` (parse booléens/nombres depuis query string), `pick.js` (extraire des clés définies d'un objet), `ids.js` (validation d'ObjectId Mongo). |
| `http/`                         | `response.js` (`sendResponse` — le format JSON standard de toute l'API), `cookies.js` (options des cookies JWT), `ip.js` (IP client, avec sel de hachage pour l'anonymisation).               |
| `logging/logger.js`             | Logger "simple" (console + fichier `logs/info.log`/`error.log`/`debug.log`/`warning.log`, sans rotation). Utilisé pour les logs de requêtes HTTP (voir section 6).                            |
| `documentation/swagger.util.js` | Génère la doc Swagger/OpenAPI à partir des routes.                                                                                                                                            |
| `validation/`                   | `validation.util.js` (schémas Joi communs), `zod.util.js` (schémas Zod, utilisés par `dry/schemas/`).                                                                                         |

### `dry/config/`, `dry/schemas/`, `dry/models/`, `dry/routes/`, `dry/scripts/`, `dry/ui/`

| Dossier                               | Rôle                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/connection/dbConnection.js`   | **LE** module de connexion réel : `connectCluster()` (une connexion Mongoose partagée) + `getTenantDB(appName)` (bascule sur la base du tenant, ex: `TrividaDB`).                             |
| `config/logger.config.js`             | Logger Winston structuré (JSON, rotation quotidienne, masquage des données sensibles via `maskSensitiveData`) → `logs/combined-<date>.log`, `logs/error-<date>.log`, `logs/debug-<date>.log`. |
| `config/prometheus.config.js`         | Métriques exposées sur `/health/metrics`.                                                                                                                                                     |
| `schemas/`                            | Schémas de validation Zod par domaine (user, tenant, apiKey, audit, conversation).                                                                                                            |
| `models/audit/AuditLog.schema.js`     | Schéma Mongoose de la collection d'audit (utilisée par `audit.middleware.js`, consultable via `dry/modules/audit/audit.routes.js`).                                                           |
| `models/apiKey/ApiKey.schema.js`      | Schéma Mongoose des clés API (stocke un hash SHA-256, jamais la clé en clair).                                                                                                                |
| `routes/health.routes.js`             | `/health/live`, `/health/ready`, `/health/startup`, `/health/metrics`.                                                                                                                        |
| `scripts/maintenance/purgeDeleted.js` | Point d'entrée CLI de `npm run purge`.                                                                                                                                                        |
| `ui/index.js`                         | Bibliothèque de composants front réutilisables, copiée par `create-frontend.js` dans chaque projet généré (`src/components/dry-ui/`).                                                         |

---

## 4. `dryApp/` — les applications tenant

Chaque sous-dossier est une app indépendante, avec sa propre base MongoDB (`<Nom>DB`), montée automatiquement sur `/api/v1/<nom-en-minuscule>` par le bootloader. Convention commune à toutes :

```
dryApp/<App>/
  index.js              (optionnel — init/montage personnalisé, ex: FreeLLM)
  seed.js                (optionnel — données de démo, appelé par scripts/seed/seed-all.js)
  features/<feature>/
    model/<x>.schema.js
    controller/<x>.controller.js
    route/<x>.routes.js
    validation/ (parfois)
```

| App                | Features                                                                                                                     | Particularité                                                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trivida**        | activity, activityRecette, auth, businessProfile, customer, debt, invoice, productCatalog, savings, stock, sync, transaction | L'app mobile en cours de soumission Play Store. Pas de `seed.js` — jamais concernée par un seed destructeur. `auth/` a une route `DELETE /account` (suppression de compte, exigence Google Play). `sync/` gère la synchro offline-first (push/pull). |
| **SCIM**           | admin, favoris, message, property, reservation, users                                                                        | Le `seed.js` de cette app est **destructeur** (`deleteMany({})` sur Property/Reservation/Message avant reseed) — ne jamais lancer `npm run seed`/`test:integration` dessus contre une vraie base.                                                    |
| **FreeLLM**        | admin, apiKeys, conversationMessages, conversations, fallbackConfig, models, requests, settings                              | Le proxy IA utilisé par Trivida (chat + OCR reçus). A son propre `index.js` avec init personnalisée (montage de routeurs custom : proxy d'inférence, clés, fallback, analytics).                                                                     |
| **LaStreet**       | admin, categories, leads, professionals, reports, subscriptions                                                              | App de mise en relation clients/professionnels ("missions").                                                                                                                                                                                         |
| **SkillForge**     | categories, courses, ebooks, export, orders, payment, reviews, students                                                      | Plateforme de formation en ligne.                                                                                                                                                                                                                    |
| **MediaDL**        | batches, downloads, presets                                                                                                  | Téléchargeur média multi-plateforme (s'appuie sur `dry/services/media/`).                                                                                                                                                                            |
| **SpiritEmeraude** | atelier, contact, formation, gallery, impact, product                                                                        | Site vitrine/atelier.                                                                                                                                                                                                                                |

---

## 5. `scripts/` — outils en ligne de commande

| Dossier                                                                                    | Contenu                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generator/create-app.js`                                                                  | Assistant (interactif ou programmatique) qui génère une app backend complète : modèle, 5 contrôleurs CRUD, routes, validation Joi, test, seed, README. Testé de bout en bout dans cette session — fonctionnel.                                |
| `generator/create-frontend.js`                                                             | Génère un frontend (React/Vite, Angular, ou React Native/Expo) pour une app existante, avec les composants `dry-ui`. Mode CLI non-interactif : `--app <app> --stack react (--all \| --feature <route>)`. Sortie dans `frontend/` (gitignoré). |
| `clients/generate-frontend-client.js`                                                      | Génère un simple client SDK (pas un projet complet) à partir du spec Swagger → `generated/` (gitignoré, untracké).                                                                                                                            |
| `seed/seed-all.js`                                                                         | Seed global : crée un admin par app + appelle le `seed.js` de chaque app si présent. Utilisé par `npm run seed` et par les tests d'intégration.                                                                                               |
| `seed/seed-clean.js`                                                                       | Contrepartie propre de seed-all : ne supprime QUE les documents que le seed a lui-même créés (via une collection `__seed_logs`), pas de wipe aveugle.                                                                                         |
| `seed/lastreet-leads-demo.js`, `seed/lastreet-trades.js`                                   | Seeds ponctuels spécifiques à LaStreet (données de démo "missions" et référentiel métiers).                                                                                                                                                   |
| `seed/seed-scim-reservation-fixtures.js`, `seed/refresh-app-seeds.js`, `seed/seed-apps.js` | Autres seeds/fixtures par app.                                                                                                                                                                                                                |
| `tests/test-runner.js`                                                                     | Orchestrateur générique de suites de tests (`--suite unit\|integration\|e2e`).                                                                                                                                                                |
| `tests/run-integration.js`, `tests/smoke-runner.js`                                        | Démarrent un serveur local (ou réutilisent celui déjà lancé), seedent, puis lancent les tests — chargent `.env.test` en priorité via `loadTestEnv.js` (voir section 6bis).                                                                    |
| `tests/loadTestEnv.js`                                                                     | Charge `.env.test` s'il existe, sinon avertit et retombe sur `.env` (production).                                                                                                                                                             |
| `swagger/`                                                                                 | Génération/reset de la doc Swagger et export Postman.                                                                                                                                                                                         |
| `maintenance/`                                                                             | Sauvegarde Mongo, monitoring de santé en continu, régénération des README par app.                                                                                                                                                            |
| `migrations/migrate.js`                                                                    | Exécute les fichiers de `migrations/` (`up`/`down`/`status`).                                                                                                                                                                                 |
| `system/status.js`                                                                         | Dashboard terminal de l'état du système (`npm run status`).                                                                                                                                                                                   |
| `dev/kill-port.js`                                                                         | Libère un port bloqué (`npm run killport`).                                                                                                                                                                                                   |

---

## 6. Les logs — deux systèmes en parallèle

C'est une source fréquente de confusion, donc explicite :

1. **Logger simple** (`dry/utils/logging/logger.js`) : `console.log` + fichier plat, sans rotation.
   - `logs/info.log`, `logs/error.log`, `logs/debug.log`, `logs/warning.log`
   - **C'est ici qu'atterrissent les logs de requêtes HTTP** (`LOG_REQUESTS=true` dans `.env`) : méthode, URL, statut, durée, **et le body de la requête** (mots de passe/tokens automatiquement masqués via `maskSensitiveData`).
   - `npm run logs` tail ces deux fichiers (`info.log` + `error.log`).

2. **Logger Winston** (`dry/config/logger.config.js`) : JSON structuré, rotation quotidienne, utilisé par les services internes (`logger.info(...)`, `logger.error(...)` dans `dry/services/*`).
   - `logs/combined-<date>.log`, `logs/error-<date>.log`, `logs/debug-<date>.log`

## 6bis. La convention `_DEV` / `_TEST` pour la config

`config/database.js` résout chaque variable via `readSetting(nom)` qui regarde, dans l'ordre : `NOM_TEST` (si `NODE_ENV=test`) ou `NOM_DEV` (si `development`) → `NOM` tout court → une valeur de repli. C'est ce mécanisme (pas un fichier) qui isole vraiment le comportement par environnement — `.env.test` n'est qu'un moyen pratique de définir des clés `_TEST` en local, exactement comme le fait `.github/workflows/ci.yml`.

---

## 7. Pour aller plus loin

- Comment démarrer en local : [01_GETTING_STARTED.md](./01_GETTING_STARTED.md)
- Conventions de code pour ajouter une feature : [02_DEVELOPER_GUIDE.md](./02_DEVELOPER_GUIDE.md)
- Le _pourquoi_ de l'architecture multi-tenant : [03_ARCHITECTURE.md](./03_ARCHITECTURE.md)
- Tests et isolation des données : [04_TESTING_GUIDE.md](./04_TESTING_GUIDE.md)
- Toutes les commandes `npm run ...` : [07_COMMANDS_REFERENCE.md](./07_COMMANDS_REFERENCE.md)
- Ce qu'on ne touche jamais sans discussion : [08_KERNEL_BOUNDARIES.md](./08_KERNEL_BOUNDARIES.md)

<!-- nav:start -->

[⬅ Retour à la doc](../README.md) · **00 · Cartographie du projet** · [Suivant : 01 · Getting Started ➡](./01_GETTING_STARTED.md)

<!-- nav:end -->
