# DRY API - Server GOLD (Cyberfusion)

Ce document est la source unique de vérité pour comprendre, utiliser et déployer le système DRY.
Signature backend obligatoire : Cyberfusion.

**Droits d'auteur**
Server GOLD — Email: servergold2012@gmail.com — Tél: +242068457521

---

## 🎯 Objectif du DRY
DRY est un socle backend multi-tenant conçu pour créer rapidement des applications API professionnelles, scalables et sécurisées.
Il intègre nativement :
- Sécurité avancée (JWT, CSRF, Helmet, Rate Limit, Mongo Sanitize)
- Validation centralisée (Joi)
- Documentation automatique (Swagger/OpenAPI)
- Cache et Audit logs
- Génération de code (Scaffolding)
- Tests automatisés

Concrètement, DRY te permet de :
1.  **Créer une app complète en 2 minutes** (Modèles, Routes, Contrôleurs, Tests).
2.  **Héberger plusieurs projets** sur le même noyau (Architecture Multi-tenant).
3.  **Standardiser tes développements** grâce à une architecture propre et modulaire.

---

## 🚀 Démarrage Rapide

### 1. Installation
```bash
npm install
```

### 2. Configuration
Copie le fichier `.env.exemple` vers `.env` et configure tes variables (MongoDB, JWT, etc.).

### 3. Lancement
```bash
# Mode Développement (avec redémarrage auto)
npm run dev

# Mode Production
npm start
```

### 4. Vérification
- API Status : `GET http://localhost:5000/`
- Documentation Swagger : `http://localhost:5000/api-docs`

---

## 🏗️ Architecture & Concepts Clés

### 1. Multi-tenant
Chaque application créée dans `dryApp/` est isolée mais partage le même noyau `dry/`.
- La base de données est sélectionnée dynamiquement via `getTenantDB(appName)`.
- Les modèles sont injectés via `req.getModel(modelName, schema)`.

### 2. Structure des Dossiers
```
d:\Alvine\dryApi\
├── dry/                  # 🧠 CŒUR DU SYSTÈME (Ne pas toucher sauf expert)
│   ├── core/             # Bootloader, Factories, Router dynamique
│   ├── middlewares/      # Sécurité, Auth, Cache, Audit, Validation
│   ├── services/         # Email, Upload, Tâches planifiées
│   └── utils/            # Helpers (JWT, Logger, Response)
│
├── dryApp/               # 📱 VOS APPLICATIONS MÉTIER
│   └── MonApp/           # Une application isolée
│       ├── features/     # Modules fonctionnels (ex: produits, users)
│       │   └── [feature]/
│       │       ├── controller/  # Logique métier (CRUD)
│       │       ├── model/       # Schéma Mongoose
│       │       └── route/       # Routes Express
│       ├── validation/   # Schémas Joi
│       └── seed.js       # Données de test
│
├── scripts/              # 🛠️ OUTILS D'AUTOMATISATION
│   ├── generator/        # Création d'app (create-app)
│   ├── swagger/          # Génération de doc
│   └── tests/            # Runner de tests
│
└── generated/            # 📦 CODE GÉNÉRÉ (Clients Frontend, SDKs)
```

### 3. Le Plugin DRY Global
Tous les modèles Mongoose bénéficient automatiquement des champs suivants :
- `label` (String) : Nom lisible
- `slug` (String) : URL friendly (généré depuis label)
- `status` (String) : 'active', 'inactive', 'deleted'
- `deletedAt` (Date) : Soft delete
- `createdBy` / `updatedBy` (ObjectId) : Traçabilité utilisateur

---

## 🛠️ Commandes Principales

### 🎨 Création d'Application
Lance l'assistant interactif pour générer une nouvelle app ou un module.
```bash
npm run create-app
```
*Options : Mode Professionnel (Templates), Mode Personnalisé, Mode Rapide.*

### 📚 Documentation (Swagger)
Gère la documentation API automatiquement.
```bash
npm run swagger:reset    # Régénère toute la doc à partir du code
npm run swagger:cleanup  # Nettoie les doublons
```

### 🧪 Tests Automatisés
```bash
npm run test             # Lance tous les tests
npm run test:crud        # Génère et lance les tests CRUD
npm run test:strict      # Échoue si le serveur est éteint
```

### 🌱 Données de Démo (Seeds)
```bash
npm run seed             # Crée un Admin global
npm run seed:apps        # Peuple les apps avec des données de test
npm run seed:clean       # Nettoie les données de test
```

### 📦 Génération Client Frontend
Génère les services et hooks pour Angular/React.
```bash
npm run client:gen
```

---

## 🛡️ Sécurité

Le système implémente les meilleures pratiques de sécurité Node.js :
1.  **Authentification** : JWT (Access + Refresh Token en cookie HTTPOnly).
2.  **Protection Injection** : `express-mongo-sanitize` (NoSQL) + Validation Joi stricte.
3.  **Headers HTTP** : `Helmet` (CSP, HSTS, X-Frame-Options).
4.  **Anti-Brute Force** : `express-rate-limit` + `authRateLimit`.
5.  **CSRF** : Protection contre le Cross-Site Request Forgery.

---

## 📝 Cycle de Développement Recommandé

1.  **Conception** : Définis tes besoins (modèles, champs).
2.  **Génération** : Utilise `npm run create-app` pour le squelette.
3.  **Développement** : Ajoute ta logique métier spécifique dans les contrôleurs.
4.  **Test** : Valide avec `npm run test` et Swagger.
5.  **Frontend** : Génère ton client API avec `npm run client:gen`.

---

## 📧 Support & Contact

Pour toute question technique ou demande d'évolution sur le noyau DRY :
**Cyberfusion - Server GOLD**
Email: servergold2012@gmail.com
Tél: +242068457521
