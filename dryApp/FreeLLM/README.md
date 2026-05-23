# FreeLLM API

Application FreeLLM pour dryApi - Point d'accès compatible OpenAI avec 11 fournisseurs LLM gratuits.

## Demarrage

1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.example`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /health/ready`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux

- /api/v1/freellm/models
- /api/v1/freellm/apiKeys
- /api/v1/freellm/requests
- /api/v1/freellm/fallbackConfig
- /api/v1/freellm/settings
- /api/v1/freellm/conversations
- /api/v1/freellm/proxy (OpenAI compatible)

## Conventions DRY

1. Le champ `label` est genere automatiquement si absent
2. Le `slug` est cree depuis `label`
3. Champs techniques DRY: status, deletedAt, createdBy, updatedBy

