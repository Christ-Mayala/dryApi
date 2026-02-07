# SCIM

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.exemple`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux
- /api/v1/scim/admin
- /api/v1/scim/favoris
- /api/v1/scim/message
- /api/v1/scim/property
- /api/v1/scim/reservation
- /api/v1/scim/users

## Details par feature (routes + payloads)
### admin
- GET /api/v1/scim/admin
- POST /api/v1/scim/admin
- GET /api/v1/scim/admin/:id
- PUT /api/v1/scim/admin/:id
- DELETE /api/v1/scim/admin/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### favoris
- GET /api/v1/scim/favoris
- POST /api/v1/scim/favoris
- GET /api/v1/scim/favoris/:id
- PUT /api/v1/scim/favoris/:id
- DELETE /api/v1/scim/favoris/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### message
- GET /api/v1/scim/message
- POST /api/v1/scim/message
- GET /api/v1/scim/message/:id
- PUT /api/v1/scim/message/:id
- DELETE /api/v1/scim/message/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### property
- GET /api/v1/scim/property
- POST /api/v1/scim/property
- GET /api/v1/scim/property/:id
- PUT /api/v1/scim/property/:id
- DELETE /api/v1/scim/property/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### reservation
- GET /api/v1/scim/reservation
- POST /api/v1/scim/reservation
- GET /api/v1/scim/reservation/:id
- PUT /api/v1/scim/reservation/:id
- DELETE /api/v1/scim/reservation/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### users
- GET /api/v1/scim/users
- POST /api/v1/scim/users
- GET /api/v1/scim/users/:id
- PUT /api/v1/scim/users/:id
- DELETE /api/v1/scim/users/:id

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
1. POST /api/v1/scim/password-reset/request
2. POST /api/v1/scim/password-reset/verify
3. POST /api/v1/scim/password-reset/reset
4. POST /api/v1/scim/password-reset/status

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
