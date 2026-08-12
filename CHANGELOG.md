# Changelog

Toutes les modifications notables de DRY API sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — 2026-08-10

### 🚀 Ajouté

#### FreeLLM Router (fallback automatique)
- Système de fallback multi-providers avec priorisation intelligente
- Circuit breaker par provider avec récupération automatique
- Retry réseau automatique (jusqu'à 4 tentatives)
- Timeout configurable par requête (60s par défaut)
- Sanitization PII cohérente backend ↔ frontends
- Cache Redis pour les clés API et configurations
- Analytics détaillées (latence, tokens, coûts, erreurs)
- Endpoints dédiés : `/api/fallback`, `/api/analytics/*`, `/api/keys`

#### Trivida Integration
- Endpoints dédiés Trivida (`/api/v1/trivida/*`)
- Schémas MongoDB pour Transaction, Customer, Activity, Debt, SavingsGoal
- Synchronisation cloud avec queue locale et retry
- Soft delete et `localId` pour la sync bidirectionnelle
- Authentification JWT + refresh token automatique

#### Sécurité
- Sanitization PII côté serveur (téléphones, emails, cartes bancaires)
- Validation XSS/NoSQL/SQL renforcée
- Chiffrement AES-256-GCM des clés API
- Isolation multi-tenant stricte par `userId`

### 📝 Modifié
- Configuration Redis centralisée avec fallback mémoire
- Amélioration du rate limiting avec fenêtre glissante Redis
- Documentation Swagger enrichie pour FreeLLM et Trivida
- Structure du projet réorganisée (`src/providers/`, `src/routes/`)

### 🐛 Corrigé
- Gestion des erreurs réseau dans le fallback provider
- Nettoyage des placeholders PII avant envoi aux providers IA
- Synchronisation des conversations entre sessions

---

## [1.0.0] — 2026-06-06

### 🚀 Ajouté

#### Infrastructure
- Suite complète de tests avec Jest et couverture minimale 70%
- Tests unitaires pour middlewares, factories et utils
- Tests d'intégration avec MongoDB en mémoire
- Tests de fumée (smoke tests) pour les endpoints critiques
- Rapport de couverture avec c8 intégré à la CI

#### Monitoring & Logging
- Logger Winston avec rotation quotidienne des fichiers
- Format structuré JSON avec masquage des données sensibles
- Middleware d'ID de requête (X-Request-ID)
- Monitoring de performance avec métriques temps réel
- Métriques Prometheus (requêtes, durée, erreurs, DB, cache)
- Endpoint `/metrics` au format Prometheus
- Health checks complets (/health/live, /ready, /startup)

#### Sécurité
- Système de versioning d'API avec headers de dépréciation
- Rate limiting amélioré avec fenêtre glissante Redis
- Validation des entrées (Content-Type, taille, patterns XSS/NoSQL)
- Middleware de validation et nettoyage XSS
- Limites de taux par rôle (public, auth, admin)

#### Base de Données
- Système de migrations MongoDB
- Schémas de validation centralisés
- Index optimisés pour les collections principales
- Sauvegardes automatisées avec compression et rotation
- Piste d'audit complète avec logs de toutes les opérations

#### Documentation
- Documentation complète des codes d'erreur (ERRORS.md)
- Guide de dépannage (TROUBLESHOOTING.md)
- Document SLA avec garanties de disponibilité
- Processus de support client

#### DevOps
- Dockerfile multi-stage optimisé
- Docker Compose (app, MongoDB, Redis, Nginx)
- Configuration Nginx avec SSL et rate limiting
- Script de migration MongoDB
- Script de backup automatisé

#### Commercial
- Système de clés API
- Pistes d'audit pour la facturation

### 🔒 Sécurité
- Ajout de validation d'entrée contre les injections XSS/NoSQL/SQL
- Headers de sécurité renforcés (CSP, HSTS, CORS)
- Rate limiting par rôle utilisateur
- Masquage des données sensibles dans les logs

### 📝 Modifié
- Architecture du projet documentée
- Scripts npm enrichis (test, migrate, backup, docker)
- Configuration centralisée dans `config/database.js`

### 🐛 Corrigé
- Gestion des erreurs améliorée avec codes spécifiques
- Protection contre les injections NoSQL dans les requêtes
- Isolation multi-tenant renforcée

### 📦 Déprécié
- API version 1 avec date de sunset: 2027-06-06

---

## [0.9.0] — 2026-05-01

### Ajouté
- Framework multi-tenant (6 applications)
- Génération automatique de clients frontend
- Documentation Swagger/OpenAPI
- Factories CRUD et routeurs
- Middleware d'authentification JWT
- Middleware de cache Redis
- Middleware d'audit
- Health monitoring
- Alerting (email, Slack, Discord)
- Gestion des clés API
- Upload Cloudinary

### Modifié
- Architecture monolithique vers framework modulaire
- Configuration centralisée avec validation

---

## [0.5.0] — 2026-03-15

### Ajouté
- Première version fonctionnelle
- Applications: SCIM, FreeLLM, LaStreet, MediaDL, SkillForge, SpiritEmeraude
- Authentification de base
- Routes CRUD
- Documentation de base
