# DRY API Framework

**🚀 Framework Node.js multi-tenant pour construire et opérer des APIs métier sécurisées, documentées et scalable.**

[![Status](https://img.shields.io/badge/status-production-ready-brightgreen)](https://dryapi.onrender.com)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-20+-339933?logo=node.js)](package.json)
[![Tests](https://img.shields.io/badge/tests-✔-brightgreen)](.github/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-70%25+-yellowgreen)](https://dryapi.onrender.com/coverage)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker)](Dockerfile)
[![Kubernetes](https://img.shields.io/badge/k8s-ready-326CE5?logo=kubernetes)](k8s/)

---

## 📋 Tableau des Features

| Fonctionnalité                      | Community |     Pro     | Enterprise |
| ----------------------------------- | :-------: | :---------: | :--------: |
| API REST complète                   |    ✅     |     ✅      |     ✅     |
| Documentation Swagger               |    ✅     |     ✅      |     ✅     |
| Multi-tenant (6 apps)               |    ✅     |     ✅      |     ✅     |
| Authentification JWT                |    ✅     |     ✅      |     ✅     |
| Rate limiting                       | 100 req/h | 1 000 req/h |  Illimité  |
| Monitoring Prometheus               |    ❌     |     ✅      |     ✅     |
| Winston Logger structuré            |    ❌     |     ✅      |     ✅     |
| Health checks (/live/ready/startup) |    ❌     |     ✅      |     ✅     |
| Métriques performance               |    ❌     |     ✅      |     ✅     |
| Validation entrées XSS/NoSQL        |    ✅     |     ✅      |     ✅     |
| Versioning API                      |    ✅     |     ✅      |     ✅     |
| Piste d'audit                       |    ❌     |     ✅      |     ✅     |
| Sauvegardes automatisées            |    ❌     |     ✅      |     ✅     |
| Module billing Stripe               |    ❌     |     ✅      |     ✅     |
| Système de licences                 |    ❌     |     ✅      |     ✅     |
| Support prioritaire                 |    ❌     |     ✅      |     ✅     |
| SLA 99.9%                           |    ❌     |     ❌      |     ✅     |
| Support dédié 24/7                  |    ❌     |     ❌      |     ✅     |

---

## 🚀 Démarrage Rapide (5 minutes)

```bash
# 1. Cloner
git clone https://github.com/cyberfusion/dry-api.git
cd dry-api

# 2. Installer les dépendances
npm install

# 3. Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (MONGO_URI, JWT_SECRET, SESSION_SECRET)

# 4. Lancer les migrations
npm run migrate:up

# 5. Démarrer le serveur
npm run dev
```

Le serveur démarrera et affichera **toutes les URLs disponibles** dans la console :

```
  🚀  DRY API SERVER READY

  ⚙ SYSTEM OVERVIEW
  Port             5000
  Base URL         http://localhost:5000

  📍 ENDPOINTS DISPONIBLES
  ─────────────────────────────────────
  🏠 Général
      → Racine API        /
      → Health (Live)     /health/live
      → Health (Ready)    /health/ready
      → Métriques         /health/metrics

  📖 Documentation
      → Swagger UI        /api-docs

  📊 Monitoring
      → Dashboard         /system/status

  💳 Billing
      → Plans             /api/v1/billing/plans

  🔌 Applications
      → Freellm           /api/v1/freellm
      → Lastreet          /api/v1/lastreet
      ...
```

---

## 📦 Commandes Disponibles

```bash
# Développement
npm run dev              # Mode développement (nodemon)
npm start                # Mode production

# Tests
npm test                 # Tests d'intégration
npm run test:unit        # Tests unitaires
npm run test:integration # Tests d'intégration complets
npm run test:smoke       # Tests de fumée
npm run coverage         # Rapport de couverture
npm run ci:check         # CI complète (lint + format + tests)
# ⚠️ test:integration/e2e/smoke lancent un seed sur toutes les apps — certains
# seeders (ex: SCIM) sont destructeurs. Copier .env.test.example en .env.test
# avec une base isolée avant de lancer ces commandes (voir docs/04_TESTING_GUIDE.md).

# Génération
npm run create-app       # Assistant pour générer une nouvelle app backend
npm run create-frontend  # Génère un frontend (React/Angular/RN) pour une app existante

# Base de données
npm run migrate:up       # Exécuter les migrations
npm run migrate:down     # Annuler la dernière migration
npm run migrate:status   # Voir le statut des migrations
npm run backup:create    # Sauvegarder MongoDB

# Docker
npm run docker:build     # Build image Docker
npm run docker:run       # Démarrer avec Docker Compose
npm run docker:stop      # Arrêter Docker Compose

# Kubernetes
npm run k8s:deploy       # Déployer sur K8s
npm run k8s:delete       # Supprimer le déploiement K8s

# Qualité
npm run lint             # ESLint
npm run lint:fix         # ESLint correction auto
npm run format           # Prettier
npm run coverage         # Rapport de couverture c8

# Monitoring
npm run health           # Vérifier health check
npm run status           # Statut du système
npm run logs             # Voir les logs en temps réel
```

---

## 🏗 Architecture

```
config/         → Configuration centralisée et validation runtime
dry/            → Noyau framework (middlewares, services, factories)

  dry/bootstrap/    → Bootstrap serveur (HTTP, routes, socket, santé)
  dry/config/       → Logger Winston, Prometheus, connexions
  dry/middlewares/  → Sécurité, auth, cache, audit, validation
  dry/modules/      → Billing, licensing, audit
  dry/schemas/      → Schémas Zod (user, conversation, apiKey, ...)
  dry/services/     → Redis, santé, alerting, notifications
  dry/utils/        → Utilitaires (auth, HTTP, validation, logging)

dryApp/         → Applications clientes multi-tenant
migrations/     → Migrations MongoDB versionnées
k8s/            → Manifests Kubernetes complets
monitoring/     → Dashboards Grafana JSON
landing/        → Pages de tarification
tests/          → Tests unitaires, intégration, smoke
docs/           → Documentation complète (10+ fichiers)
```

---

## 🔒 Sécurité

DRY implémente des mesures de sécurité robustes :

| Protection     | Technologie                                   |
| -------------- | --------------------------------------------- |
| Headers HTTP   | `helmet` (CSP, HSTS, XSS, X-Frame)            |
| Rate limiting  | Fenêtre glissante Redis + fallback mémoire    |
| Anti-injection | `express-mongo-sanitize` + patterns NoSQL/SQL |
| Anti-XSS       | Nettoyage automatique des entrées             |
| CORS           | Gestion stricte des origines autorisées       |
| JWT            | Tokens avec rotation automatique              |
| Validation     | Zod + Joi (double couche)                     |
| Audit          | Logs complets de toutes les opérations        |
| Masquage       | Données sensibles masquées dans les logs      |

---

## 📊 Monitoring

```
📈 Prometheus Metrics   → GET /health/metrics
🏥 Health Checks        → GET /health/live | /ready | /startup
📋 Dashboard Système    → GET /system/status
📝 Logs Winston         → logs/ (rotation quotidienne)
📉 Grafana Dashboard    → monitoring/grafana/dry-api-dashboard.json
```

---

## 🐳 Déploiement

### Docker

```bash
npm run docker:build
npm run docker:run       # App + MongoDB + Redis + Nginx
```

### Docker Compose (complet)

```bash
docker-compose up -d
```

### Kubernetes

```bash
kubectl create namespace dryapi
npm run k8s:deploy
```

### Render (recommandé)

```bash
# 1. Connecter le repo GitHub
# 2. Build: npm install
# 3. Start: npm start
# 4. Configurer les variables d'env
```

---

## 🔌 Applications Multi-Tenant

| Application        | Description            | Routes                     |
| ------------------ | ---------------------- | -------------------------- |
| **FreeLLM**        | API IA multi-modèle    | `/api/v1/freellm/*`        |
| **LaStreet**       | Mise en relation pro   | `/api/v1/lastreet/*`       |
| **MediaDL**        | Téléchargement média   | `/api/v1/mediadl/*`        |
| **SCIM**           | Gestion immobilière    | `/api/v1/scim/*`           |
| **SkillForge**     | E-learning & formation | `/api/v1/skillforge/*`     |
| **SpiritEmeraude** | Artisanat & boutique   | `/api/v1/spiritemeraude/*` |

---

## 📚 Documentation

Lecture séquentielle (chaque page a une navigation ⬅ précédent / suivant ➡) :

- [00 · Cartographie complète du projet](docs/00_PROJECT_MAP.md) — quoi fait quoi, dossier par dossier
- [01 · Démarrage rapide](docs/01_GETTING_STARTED.md)
- [02 · Guide développeur](docs/02_DEVELOPER_GUIDE.md)
- [03 · Architecture](docs/03_ARCHITECTURE.md)
- [04 · Guide de test](docs/04_TESTING_GUIDE.md)
- [05 · Référence API](docs/05_API_REFERENCE.md)
- [06 · Déploiement](docs/06_DEPLOYMENT.md)
- [07 · Référence commandes](docs/07_COMMANDS_REFERENCE.md)
- [08 · Frontières du kernel](docs/08_KERNEL_BOUNDARIES.md)
- [09 · Scope produit](docs/09_PRODUCT_SCOPE.md)
- [10 · Social Auth](docs/10_SOCIAL_AUTH.md)
- [11 · Générateur de frontend](docs/11_GENERATEUR_FRONTEND.md)

Références ponctuelles (non séquentielles) :

- [Codes d'erreur](docs/ERRORS.md)
- [Guide de dépannage](docs/TROUBLESHOOTING.md)
- [SLA](docs/SLA.md)
- [Support](docs/SUPPORT.md)
- [Guide de téléchargement média](docs/GUIDE_TELECHARGEMENT.md)
- [Diagrammes SCIM](docs/SCIM_DIAGRAMMES.md)
- [Configuration SenePay (Trivida)](docs/SENEPAY_CONFIG.md)
- [Réactiver Google OAuth](docs/REACTIVER_GOOGLE_OAUTH.md)
- [DRY Master Course](docs/DRY_MASTER_COURSE.md)
- [Changelog](CHANGELOG.md)

---

## 🤝 Contribution

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le workflow complet (setup, tests, conventions).

1. Fork le projet
2. Créer une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m 'feat: ajout de ma feature'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvrir une Pull Request

Les commits doivent suivre la convention [Conventional Commits](https://www.conventionalcommits.org/).

---

## 📄 Licence

DRY API Framework — Licence ISC

**Auteur:** [Cyberfusion](https://github.com/cyberfusion) — cybertouch2012@gmail.com

---

_🚀 Prêt pour la production. Sécurisé, scalable, documenté._
