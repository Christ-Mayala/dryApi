# LaStreet

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.exemple`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux
- /api/v1/lastreet/admin
- /api/v1/lastreet/categories
- /api/v1/lastreet/professionals
- /api/v1/lastreet/reports

## Details par feature (routes + payloads)
### admin
- GET /api/v1/lastreet/admin
- POST /api/v1/lastreet/admin
- GET /api/v1/lastreet/admin/:id
- PUT /api/v1/lastreet/admin/:id
- DELETE /api/v1/lastreet/admin/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### categories
- GET /api/v1/lastreet/categories
- POST /api/v1/lastreet/categories
- GET /api/v1/lastreet/categories/:id
- PUT /api/v1/lastreet/categories/:id
- DELETE /api/v1/lastreet/categories/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### professionals
- GET /api/v1/lastreet/professionals
- POST /api/v1/lastreet/professionals
- GET /api/v1/lastreet/professionals/:id
- PUT /api/v1/lastreet/professionals/:id
- DELETE /api/v1/lastreet/professionals/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### reports
- GET /api/v1/lastreet/reports
- POST /api/v1/lastreet/reports
- GET /api/v1/lastreet/reports/:id
- PUT /api/v1/lastreet/reports/:id
- DELETE /api/v1/lastreet/reports/:id

Exemple payload:
```json
{
  "label": "exemple_label"
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
1. POST /api/v1/lastreet/password-reset/request
2. POST /api/v1/lastreet/password-reset/verify
3. POST /api/v1/lastreet/password-reset/reset
4. POST /api/v1/lastreet/password-reset/status

Templates modifiables:
- dry/templates/email/password-reset.html
- dry/templates/email/password-reset-confirmation.html
## Frontend ready
1. Genere le client: `npm run client:gen`
2. Utilise `VITE_API_BASE_URL` ou `REACT_APP_API_BASE_URL`
3. Hooks disponibles: `useAdmin`, `useCreate...`, `useUpdate...`

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
