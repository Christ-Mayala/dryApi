# MediaDL

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.exemple`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux
- /api/v1/mediadl/downloads
- /api/v1/mediadl/batches
- /api/v1/mediadl/presets

## Details par feature (routes + payloads)
### downloads
- GET /api/v1/mediadl/downloads
- POST /api/v1/mediadl/downloads
- GET /api/v1/mediadl/downloads/:id
- PUT /api/v1/mediadl/downloads/:id
- DELETE /api/v1/mediadl/downloads/:id

Exemple payload:
```json
{
  "label": "exemple_label",
  "url": "exemple_url",
  "platform": "exemple_platform",
  "mediaType": "exemple_mediaType",
  "filename": "exemple_filename",
  "status": "exemple_status",
  "sizeBytes": 100,
  "error": "exemple_error",
  "requestedBy": "exemple_requestedBy",
  "startedAt": "2026-01-01T12:00:00.000Z",
  "finisheAt": "2026-01-01T12:00:00.000Z"
}
```

### batches
- GET /api/v1/mediadl/batches
- POST /api/v1/mediadl/batches
- GET /api/v1/mediadl/batches/:id
- PUT /api/v1/mediadl/batches/:id
- DELETE /api/v1/mediadl/batches/:id

Exemple payload:
```json
{
  "label": "exemple_label",
  "sourceType": "exemple_sourceType",
  "total": 100,
  "completed": 100,
  "failed": 100,
  "status": "exemple_status",
  "createdBy": "exemple_createdBy",
  "startedAt": "2026-01-01T12:00:00.000Z",
  "finishedAt": "2026-01-01T12:00:00.000Z"
}
```

### presets
- GET /api/v1/mediadl/presets
- POST /api/v1/mediadl/presets
- GET /api/v1/mediadl/presets/:id
- PUT /api/v1/mediadl/presets/:id
- DELETE /api/v1/mediadl/presets/:id

Exemple payload:
```json
{
  "label": "exemple_label",
  "qualityMode": "exemple_qualityMode",
  "preferAudioOnly": true,
  "maxHeight": 100,
  "downloadDir": "exemple_downloadDir",
  "concurrent": 100
}
```

## Comprendre la securite (simple)
1. Les routes d'ecriture utilisent `protect` + `authorize('admin')`
2. La validation Joi bloque les donnees invalides
3. Cache + audit sont actives sur les routes sensibles
4. CSP/HSTS/ReferrerPolicy sont durcis en production

## Etapes recommandees (pro)
1. Definit `ALLOWED_ORIGINS` en production (pas de `*`)
2. Definis un `JWT_SECRET` long (>= 32 caracteres)
3. Lance le seeder global pour creer un admin
4. Active le monitoring via `HEALTH_MONITOR_INTERVAL_MS`

## Password Reset (injecte automatiquement)
1. POST /api/v1/mediadl/password-reset/request
2. POST /api/v1/mediadl/password-reset/verify
3. POST /api/v1/mediadl/password-reset/reset
4. POST /api/v1/mediadl/password-reset/status

Templates modifiables:
- dry/templates/email/password-reset.html
- dry/templates/email/password-reset-confirmation.html
## Frontend ready
1. Genere le client: `npm run client:gen`
2. Utilise `VITE_API_BASE_URL` ou `REACT_APP_API_BASE_URL`
3. Hooks disponibles: `useDownloads`, `useCreate...`, `useUpdate...`

## Conventions DRY
1. Le champ `label` est genere automatiquement si absent
2. Le `slug` est cree depuis `label`
3. Champs techniques DRY: status, deletedAt, createdBy, updatedBy

## Tests
1. Lancer tous les tests: `npm run test`
2. Smoke test HTTP: `npm run test:smoke`

## Signature Backend
Ce backend est signe **Cyberfusion** (Server GOLD).
Email: servergold2012@gmail.com
Tel: +242068457521
