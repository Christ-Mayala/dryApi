# Demarrage rapide

<!-- nav:start -->

[⬅ Précédent : 00 · Cartographie du projet](./00_PROJECT_MAP.md) · **01 · Getting Started** · [Suivant : 02 · Developer Guide ➡](./02_DEVELOPER_GUIDE.md)

<!-- nav:end -->

Ce guide te permet de lancer DRY API localement, creer une app, verifier les endpoints critiques et ouvrir Swagger en moins de 10 minutes.

## Prerequis

- Node.js 20+
- MongoDB 6+ ou 7+ (local, Docker ou Atlas)
- npm

## 1. Installer les dependances

```bash
npm install
```

## 2. Preparer MongoDB

DRY API necessite une instance MongoDB. Tu as 3 options :

### Option A : MongoDB local (recommandé pour le dev)

Telecharge et installe MongoDB Community Edition, puis demarre le service :

```bash
# Windows (service)
net start MongoDB

# macOS (brew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### Option B : MongoDB avec Docker

```bash
docker run -d -p 27017:27017 --name mongodb mongo:7
```

### Option C : MongoDB Atlas (cloud)

Cree un cluster gratuit sur https://www.mongodb.com/atlas et recupere la chaine de connexion.

## 3. Configurer l'environnement

Partir du modele fourni :

```bash
cp .env.example .env
```

Variables minimales a renseigner :

- `MONGO_URI` — voir les exemples ci-dessous
- `JWT_SECRET` — au moins 32 caracteres aleatoires
- `SESSION_SECRET` — au moins 32 caracteres aleatoires

Exemples de `MONGO_URI` :

```bash
# Local
MONGO_URI=mongodb://localhost:27017/dryapi

# Docker
MONGO_URI=mongodb://localhost:27017/dryapi

# Atlas
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dryapi?retryWrites=true&w=majority
```

Regle simple :

- ne jamais committer un vrai `.env`
- utiliser des secrets differents entre local, preview et production

## 4. Lancer le serveur

```bash
npm run dev
```

Le serveur demarre par defaut sur `http://localhost:5000`.

## 5. Verifier le socle

Endpoints a tester :

- `GET /health/ready`
- `GET /`
- `GET /api-docs`

Exemples :

```bash
curl http://localhost:5000/health/ready
curl http://localhost:5000/
```

## 6. Creer une nouvelle app

```bash
npm run create-app
```

Le generateur te cree la base d'une app dans `dryApp/<NomApp>/`.

## 7. Tester une route

Une fois une app montee, les routes suivent ce format :

```text
/api/v1/<app>/<feature>
```

Exemple :

```bash
curl http://localhost:5000/api/v1/scim/reservation
```

## 8. Ouvrir Swagger

[http://localhost:5000/api-docs](http://localhost:5000/api-docs)

## 9. Lancer les checks utiles

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:smoke
```

## Troubleshooting rapide

### Port 5000 deja utilise

```bash
npm run killport
```

### MongoDB refuse la connexion

- Verifie que le service est demarre : `mongosh` ou `docker ps`
- Verifie `MONGO_URI` dans `.env`
- Si tu utilises Atlas, assure-toi que ton IP est autorisee dans le Network Access

### Variables d'environnement manquantes

Le serveur refuse de demarrer si `MONGO_URI`, `JWT_SECRET` ou `SESSION_SECRET` sont absents ou trop faibles. Vérifie ton `.env`.

### Le serveur demarre mais Swagger est vide

Lance `npm run swagger:reset` pour regenerer la documentation.

## Suite logique

- [Guide developpeur](./02_DEVELOPER_GUIDE.md)
- [Architecture](./03_ARCHITECTURE.md)
- [Conventions kernel vs app](./08_KERNEL_BOUNDARIES.md)

<!-- nav:start -->

[⬅ Précédent : 00 · Cartographie du projet](./00_PROJECT_MAP.md) · **01 · Getting Started** · [Suivant : 02 · Developer Guide ➡](./02_DEVELOPER_GUIDE.md)

<!-- nav:end -->
