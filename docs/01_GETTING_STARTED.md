# Demarrage rapide

Ce guide te permet de lancer DRY API localement, creer une app, verifier les endpoints critiques et ouvrir Swagger en moins de 10 minutes.

## Prerequis

- Node.js 20+
- MongoDB 6+ ou 7+
- npm

## 1. Installer

```bash
npm install
```

## 2. Configurer l'environnement

Partir du modele fourni:

```bash
cp .env.example .env
```

Variables minimales a renseigner:

- `MONGO_URI`
- `JWT_SECRET`
- `SESSION_SECRET`

Regle simple:

- ne jamais committer un vrai `.env`
- utiliser des secrets differents entre local, preview et production

## 3. Lancer le serveur

```bash
npm run dev
```

Le serveur demarre par defaut sur `http://localhost:5000`.

## 4. Verifier le socle

Endpoints a tester:

- `GET /health/ready`
- `GET /`
- `GET /api-docs`

Exemples:

```bash
curl http://localhost:5000/health/ready
curl http://localhost:5000/
```

## 5. Creer une nouvelle app

```bash
npm run create-app
```

Le generateur te cree la base d'une app dans `dryApp/<NomApp>/`.

## 6. Tester une route

Une fois une app montee, les routes suivent ce format:

```text
/api/v1/<app>/<feature>
```

Exemple:

```bash
curl http://localhost:5000/api/v1/scim/reservation
```

## 7. Ouvrir Swagger

[http://localhost:5000/api-docs](http://localhost:5000/api-docs)

## 8. Lancer les checks utiles

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:smoke
```

## Suite logique

- [Guide developpeur](./02_DEVELOPER_GUIDE.md)
- [Architecture](./03_ARCHITECTURE.md)
- [Conventions kernel vs app](./08_KERNEL_BOUNDARIES.md)
