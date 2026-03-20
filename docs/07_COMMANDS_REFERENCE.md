# 🛠️ Référence Complète des Commandes (CLI Master)

Toutes les commandes sont orchestrées via `npm run`. En tant qu'expert, tu dois connaître ces outils pour automatiser ton flux de travail.

---

## 🏃‍♂️ Démarrage & Développement

| Commande | Niveau | Description |
| :--- | :--- | :--- |
| `npm run dev` | 🟢 | **Mode Agile**. Redémarrage auto avec `nodemon`. Idéal pour coder. |
| `npm start` | 🔴 | **Mode Prod**. Optimisation Kernel active. Jamais de nodemon en prod ! |
| `npm run status` | 🔵 | Ping rapide pour voir si le moteur répond. |
| `npm run killport` | ⚡ | **SOS**. Libère le port 5000 s'il est bloqué par un ancien processus. |

---

## 🏗️ Génération & Architecture (Scaffolding)

| Commande | Niveau | Description |
| :--- | :--- | :--- |
| `npm run create-app` | 🚀 | **L'Assistant**. Génère Apps et Features avec la nouvelle `routerFactory`. |
| `npm run client:gen` | 🎨 | Génère le SDK Frontend (Hooks, Services) pour React/Vue. |
| `npm run docs:build` | 📚 | Régénère toute la documentation technique et Swagger. |

---

## 🗄️ Gestion des Données (Database)

| Commande | Niveau | Description |
| :--- | :--- | :--- |
| `npm run db:seed` | 🌱 | Injecte les données de démonstration dans tes bases clients. |
| `npm run db:purge` | 🧹 | Supprime physiquement les données en `status: deleted`. |
| `npm run db:reset` | 🔥 | Vide tout et ré-injecte le seed. Utile pour repartir de zéro. |

---

## 🧪 Tests & Diagnostics

| Commande | Niveau | Description |
| :--- | :--- | :--- |
| `npm run test` | 🛡️ | Lance la suite de tests complète (Unit & Integration). |
| `npm run test:smoke` | 💨 | Vérifie les endpoints vitaux en moins de 2 secondes. |
| `npm run monitor:health`| 🚑 | Scrutage temps réel : CPU, RAM, Latence MongoDB, Uptime. |

---

## 📊 Monitoring des Logs (Real-time)

| Commande | Description |
| :--- | :--- |
| `npm run logs:info` | Observe le flux d'activité normal. |
| `npm run logs:error` | Focus uniquement sur les crashs et alertes critiques. |
| `npm run logs:all` | Vue panoramique de toute l'activité du serveur. |

---
*Une commande bien exécutée est une tâche automatisée.*
