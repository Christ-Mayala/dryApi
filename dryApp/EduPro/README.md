# EduPro

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.exemple`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux
- /api/v1/edupro/etudiants
- /api/v1/edupro/cours
- /api/v1/edupro/inscriptions

## Details par feature (routes + payloads)
### etudiants
- GET /api/v1/edupro/etudiants
- POST /api/v1/edupro/etudiants
- GET /api/v1/edupro/etudiants/:id
- PUT /api/v1/edupro/etudiants/:id
- DELETE /api/v1/edupro/etudiants/:id

Exemple payload:
```json
{
  "nom": "exemple_nom",
  "prenom": "exemple_prenom",
  "email": "demo@example.com",
  "telephone": "+22501020304",
  "niveau": "exemple_niveau",
  "label": "exemple_label"
}
```

### cours
- GET /api/v1/edupro/cours
- POST /api/v1/edupro/cours
- GET /api/v1/edupro/cours/:id
- PUT /api/v1/edupro/cours/:id
- DELETE /api/v1/edupro/cours/:id

Exemple payload:
```json
{
  "titre": "exemple_titre",
  "description": "exemple_description",
  "niveau": "exemple_niveau",
  "duree": 100,
  "prix": 100,
  "label": "exemple_label"
}
```

### inscriptions
- GET /api/v1/edupro/inscriptions
- POST /api/v1/edupro/inscriptions
- GET /api/v1/edupro/inscriptions/:id
- PUT /api/v1/edupro/inscriptions/:id
- DELETE /api/v1/edupro/inscriptions/:id

Exemple payload:
```json
{
  "etudiantId": "exemple_etudiantId",
  "coursId": "exemple_coursId",
  "dateInscription": "2026-01-01T12:00:00.000Z",
  "statut": "exemple_statut",
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
1. POST /api/v1/edupro/password-reset/request
2. POST /api/v1/edupro/password-reset/verify
3. POST /api/v1/edupro/password-reset/reset
4. POST /api/v1/edupro/password-reset/status

Templates modifiables:
- dry/templates/email/password-reset.html
- dry/templates/email/password-reset-confirmation.html
## Frontend ready
1. Genere le client: `npm run client:gen`
2. Utilise `VITE_API_BASE_URL` ou `REACT_APP_API_BASE_URL`
3. Hooks disponibles: `useEtudiants`, `useCreate...`, `useUpdate...`

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
