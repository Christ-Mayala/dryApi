# Social Auth (Google + Facebook)

Ce document decrit ce qui est **deja implemente** dans le backend DRY, et ce qu'il reste a faire cote frontend/config pour que l'authentification Google/Facebook fonctionne de bout en bout.

## Statut

- OK: Routes backend OAuth (Google/Facebook) sous `/api/auth/*`.
- OK: Creation / liaison de l'utilisateur **dans la DB du tenant** (multi-tenant).
- OK: Redirection vers le frontend avec `token` + `refreshToken`.
- A faire: UI frontend (boutons "Continuer avec Google/Facebook") + page `/auth/callback` qui consomme les query params.

## Variables d'environnement

Dans `.env` (voir aussi `.env.example`):

- `SERVER_URL` (ex: `http://localhost:5000`) : base utilisee pour construire les callback URLs si non override.
- `FRONTEND_URL` (ex: `http://localhost:5173`) : ou rediriger apres succes/erreur.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`

Optionnel (override explicite des callbacks; sinon `SERVER_URL` est utilise):

- `GOOGLE_CALLBACK_URL` (ex: `https://api.mondomaine.com/api/auth/google/callback`)
- `FACEBOOK_CALLBACK_URL` (ex: `https://api.mondomaine.com/api/auth/facebook/callback`)

## Endpoints

Ces routes sont montees globalement par le bootloader:

- `GET /api/auth/google?app=<TENANT>`
- `GET /api/auth/google/callback`
- `GET /api/auth/facebook?app=<TENANT>`
- `GET /api/auth/facebook/callback`

`app` est **obligatoire** et correspond au nom du dossier dans `dryApp/` (ex: `SCIM`, `LaStreet`, `SkillForge`).

## Flux (navigateur)

1. Frontend redirige l'utilisateur vers:
   - `SERVER_URL/api/auth/google?app=SCIM`
   - ou `SERVER_URL/api/auth/facebook?app=SCIM`
2. L'utilisateur se connecte chez le provider.
3. Le provider redirige vers le callback backend.
4. Le backend:
   - cree/lien l'utilisateur dans la base Mongo du tenant cible,
   - genere `token` (access) + `refreshToken`,
   - redirige vers: `FRONTEND_URL/auth/callback?token=...&refreshToken=...&provider=google&app=SCIM`

## Attendu cote frontend

Implementer une page/route `GET /auth/callback` qui:

1. Lit `token`, `refreshToken`, `provider`, `app` depuis la query string.
2. Stocke les tokens (ex: localStorage) ou les envoie a ton gestionnaire de session.
3. Redirige ensuite vers la page de l'app (dashboard, profil, etc.).

## Limitations / points d'attention

- Facebook ne fournit pas toujours l'email: il faut que l'app Facebook soit configuree avec la permission email et que le compte possede un email.
- OAuth utilise la session Express pour transporter le tenant pendant la redirection (cookie `sameSite=lax`).

