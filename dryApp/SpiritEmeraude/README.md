# SpiritEmeraude

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.exemple`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux
- /api/v1/spiritemeraude/atelier
- /api/v1/spiritemeraude/contact
- /api/v1/spiritemeraude/formation
- /api/v1/spiritemeraude/gallery
- /api/v1/spiritemeraude/impact
- /api/v1/spiritemeraude/product

## Details par feature (routes + payloads)
### atelier
- GET /api/v1/spiritemeraude/atelier
- POST /api/v1/spiritemeraude/atelier
- GET /api/v1/spiritemeraude/atelier/:id
- PUT /api/v1/spiritemeraude/atelier/:id
- DELETE /api/v1/spiritemeraude/atelier/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### contact
- GET /api/v1/spiritemeraude/contact
- POST /api/v1/spiritemeraude/contact
- GET /api/v1/spiritemeraude/contact/:id
- PUT /api/v1/spiritemeraude/contact/:id
- DELETE /api/v1/spiritemeraude/contact/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### formation
- GET /api/v1/spiritemeraude/formation
- POST /api/v1/spiritemeraude/formation
- GET /api/v1/spiritemeraude/formation/:id
- PUT /api/v1/spiritemeraude/formation/:id
- DELETE /api/v1/spiritemeraude/formation/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### gallery
- GET /api/v1/spiritemeraude/gallery
- POST /api/v1/spiritemeraude/gallery
- GET /api/v1/spiritemeraude/gallery/:id
- PUT /api/v1/spiritemeraude/gallery/:id
- DELETE /api/v1/spiritemeraude/gallery/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### impact
- GET /api/v1/spiritemeraude/impact
- POST /api/v1/spiritemeraude/impact
- GET /api/v1/spiritemeraude/impact/:id
- PUT /api/v1/spiritemeraude/impact/:id
- DELETE /api/v1/spiritemeraude/impact/:id

Exemple payload:
```json
{
  "label": "exemple_label"
}
```

### product
- GET /api/v1/spiritemeraude/product
- POST /api/v1/spiritemeraude/product
- GET /api/v1/spiritemeraude/product/:id
- PUT /api/v1/spiritemeraude/product/:id
- DELETE /api/v1/spiritemeraude/product/:id

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
1. POST /api/v1/spiritemeraude/password-reset/request
2. POST /api/v1/spiritemeraude/password-reset/verify
3. POST /api/v1/spiritemeraude/password-reset/reset
4. POST /api/v1/spiritemeraude/password-reset/status

Templates modifiables:
- dry/templates/email/password-reset.html
- dry/templates/email/password-reset-confirmation.html
## Frontend ready
1. Genere le client: `npm run client:gen`
2. Utilise `VITE_API_BASE_URL` ou `REACT_APP_API_BASE_URL`
3. Hooks disponibles: `useAtelier`, `useCreate...`, `useUpdate...`

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
