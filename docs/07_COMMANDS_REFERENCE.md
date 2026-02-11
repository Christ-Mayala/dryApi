# 🛠️ Référence Complète des Commandes (CLI)

Ce document liste toutes les commandes disponibles via `npm run`. Elles sont vos outils pour développer, tester et maintenir le projet DRY.

## 🏃‍♂️ Démarrage & Développement

| Commande | Description |
| :--- | :--- |
| `npm run dev` | **Mode Développement**. Lance le serveur avec `nodemon` (redémarrage auto à chaque sauvegarde). |
| `npm start` | **Mode Production**. Lance le serveur avec `node` (optimisé pour la perf). |
| `npm run status` | Vérifie si le serveur est en ligne et répond (Health Check). |
| `npm run killport` | **SOS**. Tue tous les processus qui occupent le port 5000 (utile si le serveur est "coincé"). |

## 🏗️ Génération de Code (Scaffolding)

| Commande | Description |
| :--- | :--- |
| `npm run create-app` | **Le Magicien**. Lance l'assistant interactif pour créer une App ou une Feature. |
| `npm run client:gen` | Génère un client API (SDK) pour le Frontend (React, Vue, etc.) basé sur votre code. |
| `npm run postman:generate` | Génère une collection Postman complète pour tester votre API. |

## 🗄️ Base de Données (Database)

| Commande | Description |
| :--- | :--- |
| `npm run db:seed` | Remplit la base de données avec des données de test (fictives). |
| `npm run db:purge` | **Attention**. Supprime définitivement les données marquées comme "deleted" (Soft Delete). |
| `npm run db:reset` | **Attention**. Vide tout (Purge) et remplit à nouveau (Seed). Remise à zéro complète. |
| `npm run backup:mongo` | Crée une sauvegarde (dump) de toutes les bases de données MongoDB locales. |

## 🧪 Tests & Qualité

| Commande | Description |
| :--- | :--- |
| `npm test` | Lance tous les tests unitaires et d'intégration. |
| `npm run test:smoke` | "Smoke Test". Vérifie juste que les routes principales ne crashent pas (rapide). |
| `npm run test:crud` | Génère des tests CRUD pour vos features et les lance. |
| `npm run test:strict` | Lance les tests en mode strict (fail au premier warning). |
| `npm run test:app` | Lance uniquement les tests des Applications (dossier `dryApp`). |
| `npm run test:feature` | Lance uniquement les tests des Features spécifiques. |

## 📚 Documentation (Swagger)

| Commande | Description |
| :--- | :--- |
| `npm run swagger:generate` | Régénère manuellement le fichier `swagger.json` (OpenAPI). |
| `npm run swagger:reset` | Supprime et recrée la documentation Swagger de zéro (en cas de bug d'affichage). |
| `npm run swagger:docs` | Affiche les liens vers la documentation dans le terminal. |

## 📊 Monitoring & Logs

| Commande | Description |
| :--- | :--- |
| `npm run logs:info` | Affiche les logs d'information en temps réel (`tail -f`). |
| `npm run logs:error` | Affiche uniquement les erreurs en temps réel. |
| `npm run logs:all` | Affiche TOUS les logs (Info, Error, Warning) simultanément. |
| `npm run monitor:health` | Lance un diagnostic complet du système (CPU, Mémoire, DB). |

## 🧹 Maintenance Système

| Commande | Description |
| :--- | :--- |
| `npm run seed:clean` | Nettoie les fichiers de seed orphelins. |
| `npm run seed:refresh` | Rafraîchit les données de seed des applications. |
| `npm run swagger:clean` | Force le nettoyage des fichiers temporaires Swagger. |
