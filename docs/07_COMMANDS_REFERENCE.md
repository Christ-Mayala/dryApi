# Référence des commandes DRY API

Ce document liste toutes les commandes disponibles via `npm run` dans le framework DRY API. Chaque commande est conçue pour automatiser une partie du cycle de vie du développement, du test ou de la maintenance.

## 🚀 Développement et Lancement

| Commande | Script | Description |
| :--- | :--- | :--- |
| `npm start` | `server.js` | Démarre le serveur en mode production. |
| `npm run dev` | `nodemon server.js` | Démarre le serveur en mode développement avec rechargement automatique (hot-reload). |
| `npm run killport` | `scripts/dev/kill-port.js` | Libère le port `5000` s'il est déjà utilisé (utile en cas de crash précédent). |

## 📊 Monitoring et Statut

| Commande | Script | Description |
| :--- | :--- | :--- |
| `npm run status` | `scripts/system/status.js` | Affiche un résumé complet de l'état du système (DB, Redis, Apps) directement dans le terminal. |
| `npm run monitor:health` | `scripts/maintenance/monitor-health.js` | Effectue un check de santé unique sur les endpoints `/health/ready`. |
| `npm run monitor:health:watch`| `scripts/maintenance/monitor-health-runner.js` | Lance un monitoring en continu de la santé du serveur avec alertes. |

## 🧪 Tests et Qualité

| Commande | Description |
| :--- | :--- |
| `npm run test:unit` | Lance les tests unitaires du noyau (`dry/`). |
| `npm run test:integration` | **Cycle complet** : Démarre un serveur de test, attend qu'il soit prêt, injecte les données de seed, lance les tests applicatifs, puis arrête le serveur. |
| `npm run test:smoke` | Vérifie simplement si les endpoints vitaux (`/health/ready`) répondent. |
| `npm run test:all` | Exécute l'intégralité des suites (unit + integration + e2e). |
| `npm run coverage` | Mesure le taux de couverture du code par les tests (via `c8`). |
| `npm run lint` | Analyse le code pour détecter des erreurs de syntaxe ou de style. |
| `npm run lint:fix` | Tente de corriger automatiquement les erreurs détectées par le linter. |
| `npm run format` | Réinitialise le formatage de tous les fichiers selon les règles Prettier. |
| `npm run ci:check` | Commande combinée (lint + format + tests) utilisée par la CI GitHub Actions. |

## 🛠️ Génération et Outils

| Commande | Description |
| :--- | :--- |
| `npm run create-app` | Assistant interactif pour générer une nouvelle application cliente ou une nouvelle feature. |
| `npm run swagger:generate` | Analyse le code et génère la documentation Swagger. |
| `npm run swagger:reset` | Supprime et régénère proprement toute la documentation API. |
| `npm run client:gen` | Génère un client SDK frontend à partir de la spécification Swagger. |
| `npm run postman:generate` | Exporte la documentation API sous forme de collection Postman. |

## 🧹 Maintenance et Données

| Commande | Description |
| :--- | :--- |
| `npm run seed` | Injecte les données initiales (utilisateurs, configs) dans la base de données. |
| `npm run purge` | Supprime définitivement les entrées marquées comme "soft-deleted" dans la base. |
| `npm run backup:mongo` | Crée une sauvegarde (dump) de la base de données MongoDB. |

---

> [!TIP] 
> Vous pouvez retrouver l'état visuel de ces services sur la page [System Status](http://localhost:5000/system/status) une fois le serveur lancé.
