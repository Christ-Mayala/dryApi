# ImmoPro

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: `npm install`
2. Cree ton fichier .env a partir de `.env.exemple`
3. Demarre le serveur: `npm run dev`
4. Verifie la sante: `GET /`
5. Ouvre la doc Swagger: `http://localhost:5000/api-docs`

## Endpoints principaux
- /api/v1/immopro/biens
- /api/v1/immopro/visites
- /api/v1/immopro/clients

## Details par feature (routes + payloads)
### biens
- GET /api/v1/immopro/biens
- POST /api/v1/immopro/biens
- GET /api/v1/immopro/biens/:id
- PUT /api/v1/immopro/biens/:id
- DELETE /api/v1/immopro/biens/:id

Exemple payload:
```json
{
  "titre": "exemple_titre",
  "description": "exemple_description",
  "prix": 100,
  "type": "exemple_type",
  "surface": 100,
  "chambres": 100,
  "sallesDeBain": 100,
  "adresse": "exemple_adresse",
  "ville": "exemple_ville",
  "codePostal": "exemple_codePostal",
  "disponible": true,
  "label": "exemple_label"
}
```

### visites
- GET /api/v1/immopro/visites
- POST /api/v1/immopro/visites
- GET /api/v1/immopro/visites/:id
- PUT /api/v1/immopro/visites/:id
- DELETE /api/v1/immopro/visites/:id

Exemple payload:
```json
{
  "bienId": "exemple_bienId",
  "clientId": "exemple_clientId",
  "dateVisite": "2026-01-01T12:00:00.000Z",
  "statut": "exemple_statut",
  "commentaire": "exemple_commentaire",
  "label": "exemple_label"
}
```

### clients
- GET /api/v1/immopro/clients
- POST /api/v1/immopro/clients
- GET /api/v1/immopro/clients/:id
- PUT /api/v1/immopro/clients/:id
- DELETE /api/v1/immopro/clients/:id

Exemple payload:
```json
{
  "nom": "exemple_nom",
  "email": "demo@example.com",
  "telephone": "+22501020304",
  "budget": 100,
  "recherche": "exemple_recherche",
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
1. POST /api/v1/immopro/password-reset/request
2. POST /api/v1/immopro/password-reset/verify
3. POST /api/v1/immopro/password-reset/reset
4. POST /api/v1/immopro/password-reset/status

Templates modifiables:
- dry/templates/email/password-reset.html
- dry/templates/email/password-reset-confirmation.html
## Frontend ready
1. Genere le client: `npm run client:gen`
2. Utilise `VITE_API_BASE_URL` ou `REACT_APP_API_BASE_URL`
3. Hooks disponibles: `useBiens`, `useCreate...`, `useUpdate...`

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
