# DRY API - Server GOLD (Cyberfusion)

Ce document est la source unique de verite pour comprendre, utiliser et deployer le systeme DRY.
Signature backend obligatoire : Cyberfusion.

Droits d'auteur
Server GOLD — Email: servergold2012@gmail.com — Tel: +242068457521

## Objectif du DRY
DRY est un socle backend multi-tenant pour creer rapidement des applications API professionnelles,
avec securite, validation, logs, swagger, cache, audit et generation automatique (routes + tests).

Concretement, DRY te permet de:
- creer une nouvelle app en quelques minutes
- obtenir un CRUD complet par feature
- documenter automatiquement via Swagger
- generer des tests et des clients frontend
- garder une architecture claire, stable et extensible

## Demarrage rapide (debutant)
1. Installer les dependances: `npm install`
2. Copier `.env.exemple` vers `.env` et remplir les variables
3. Lancer le serveur: `npm run dev`
4. Ouvrir Swagger: `http://localhost:5000/api-docs`

Si tu es debutant, commence par:
- `npm run create-app` pour generer une app
- `npm run seed` pour creer un admin par defaut
- `npm run test` pour valider que tout fonctionne

## Concepts cles (simple)
1. Multi-tenant: chaque application a sa base via `getTenantDB(appName)`
2. Modeles dynamiques: `req.getModel(modelName, schema)` injecte par le bootloader
3. DRY plugin: ajoute `label`, `slug`, `status`, `deletedAt`, `createdBy`, `updatedBy`
4. Securite: JWT + validation Joi + rate limit + headers (helmet)
5. Logs: logs centralises + `requestId` pour tracer chaque requete

Exemple simple:
- tu crees une feature `produits`
- DRY genere schema, controllers, routes, validation, tests, swagger
- tu ajoutes seulement ta logique metier

## Structure d'une application
```
dryApp/<App>/
  features/<feature>/
    model/        # schema Mongoose
    controller/   # CRUD separes (getAll, getById, create, update, delete)
    route/        # routes securisees + swagger
  validation/     # schemas Joi + middlewares
  seed.js         # seeder individuel (donnees de demo)
  README.md       # doc locale de l'app
```

## Structure globale du projet (vue rapide)
- `dry/` : coeur du framework DRY (middlewares, services, utils)
- `dryApp/` : applications generes (une app = un dossier)
- `scripts/` : scripts de generation, swagger, tests, seed, maintenance
- `tests/` : tests auto generes par app + tests de validation
- `generated/` : clients frontend (React/Angular) + Postman

## Commandes (role de chaque commande)
### Serveur
- `npm run dev` : demarre le serveur en mode developpement
- `npm start` : demarre le serveur en mode production

### Creation d'app
- `npm run create-app` : lance le generateur d'applications (modes + templates)

### Swagger
- `npm run swagger:generate` : ajoute des commentaires swagger si manquants
- `npm run swagger:reset` : reset propre (nettoie + regenere)
- `npm run swagger:cleanup` : nettoyage final des doublons
- `npm run swagger:clean` : nettoyage brut des commentaires swagger
- `npm run docs:build` : reset swagger + affiche liens docs

Explication simple:
- `generate` ajoute si absent
- `clean` supprime tout
- `reset` fait clean + regen complet
- `cleanup` corrige les doublons

### Tests
- `npm run test` : lance tous les tests (resume clair)
- `npm run test:strict` : tests + echec si serveur indisponible
- `npm run test:app -- <App>` : tests d'une seule app
- `npm run test:feature -- <App> <feature>` : test d'une feature precise
- `npm run test:list` : liste tous les tests par application
- `npm run test:crud` : regenere tests CRUD + lance les tests

Explication simple:
- `test` = tous les tests
- `test:strict` = bloque si le serveur ne tourne pas
- `test:app` = uniquement une app
- `test:feature` = uniquement une feature

### Seed (donnees de demo)
- `npm run seed` : cree un admin par application (global)
- `npm run seed:apps` : lance les seeders individuels de chaque app
- `npm run seed:clean` : supprime uniquement les donnees seed (sans toucher aux users)
- `npm run seed:refresh` : regenere tous les seeders individuels

Explication simple:
- `seed` = admin global
- `seed:apps` = donnees metier par app
- `seed:clean` = nettoyer les donnees ajoutees par seeds

### Clients frontend
- `npm run client:gen` : genere clients React/Angular + hooks + types

### Postman
- `npm run postman:generate` : genere une collection Postman

### Monitoring / Backups
- `npm run monitor:health` : verifie /health/ready et alerte si probleme
- `npm run backup:mongo` : backup Mongo (mongodump requis)

## Tutoriel complet (pas a pas)
### 1) Creer une app
1. `npm run create-app`
2. Choisir un mode (Professionnel / Personnalise / Rapide)
3. Donner un nom (ex: ImmoPro)
4. Les fichiers sont generes dans `dryApp/ImmoPro`

### 2) Lancer le serveur
`npm run dev`

### 3) Tester l'app
- Tests complets: `npm run test`
- Tests stricts (serveur obligatoire): `npm run test:strict`

### 4) Seeder (donnees de demo)
- Admin global: `npm run seed`
- Donnees par app: `npm run seed:apps`
- Nettoyage des seeds: `npm run seed:clean`

### 5) Swagger
- `npm run swagger:reset`
- Ouvrir `http://localhost:5000/api-docs`

### 6) Frontend
- `npm run client:gen`
- Utiliser les hooks React generes dans `generated/clients/<App>/react/`

## Cycle de developpement conseille
1. Creer une app
2. Lancer le serveur
3. Lancer Swagger pour verifier les routes
4. Generer des tests et les executer
5. Creer ou ajuster les seeders
6. Generer le client frontend

## Password Reset (injecte automatiquement)
Routes disponibles (multi-tenant et par app):
- `/api/v1/:tenant/password-reset/request`
- `/api/v1/:tenant/password-reset/verify`
- `/api/v1/:tenant/password-reset/reset`
- `/api/v1/:tenant/password-reset/status`

Templates email modifiables:
- `dry/templates/email/password-reset.html`
- `dry/templates/email/password-reset-confirmation.html`

## Monitoring / Alerting (simple)
Le monitoring envoie une alerte si le serveur n'est pas pret.
Variables utiles:
- `HEALTH_MONITOR_INTERVAL_MS` (ex: 60000)
- `ALERT_WEBHOOK_URL` (webhook generic)
- `SLACK_WEBHOOK_URL` (Slack)
- `DISCORD_WEBHOOK_URL` (Discord)
- `ALERT_EMAIL_TO` + `EMAIL_HOST/EMAIL_USER/EMAIL_PASS` (email)

## Questions frequentes (debutant)
Q: Ou sont mes routes?
R: Dans `dryApp/<App>/features/<feature>/route/`

Q: Ou sont mes schemas?
R: Dans `dryApp/<App>/features/<feature>/model/`

Q: Ou sont mes validations?
R: Dans `dryApp/<App>/validation/`

Q: Comment changer le template email?
R: Modifie `dry/templates/email/password-reset.html`

## Bonnes pratiques production
1. Toujours definir `ALLOWED_ORIGINS` (pas de `*`)
2. Utiliser HTTPS (reverse proxy)
3. Secrets forts: `JWT_SECRET` >= 32 caracteres
4. Rotation JWT: `JWT_SECRET_PREVIOUS`
5. Activer logs + monitoring
6. Faire des backups Mongo reguliers

## Signature backend
Ce backend est signe Cyberfusion et doit conserver cette signature.
