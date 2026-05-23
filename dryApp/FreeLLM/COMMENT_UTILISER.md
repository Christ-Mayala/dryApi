# Guide d'utilisation FreeLLM

## 1. Lancer MongoDB
- Soit en local : installe MongoDB Community et lance-le
- Soit en cloud : crée un cluster sur MongoDB Atlas et mettez la connection string dans config/database.js

## 2. Lancer le serveur dryApi
```bash
cd d:\Alvine\dryApi
npm start
```

## 3. Les endpoints FreeLLM disponibles
Toutes les routes sont sur : `/api/v1/freellm`

- GET `/api/v1/freellm/v1/models` → Liste des modèles
- POST `/api/v1/freellm/v1/chat/completions` → Appel OpenAI-compatible
- GET/POST `/api/v1/freellm/keys` → Gestion des clés API
- GET/PUT `/api/v1/freellm/fallback` → Configuration de la chaîne de secours
- GET `/api/v1/freellm/analytics/...` → Analytics

## 4. Adapter le frontend (freellmapi/client)
Mettez à jour le fichier `d:\Alvine\freellmapi\client\src\lib\api.ts` pour pointer vers :
`http://localhost:5000/api/v1/freellm`
