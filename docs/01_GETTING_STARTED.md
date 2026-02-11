# 🚀 Démarrage Rapide (Getting Started)

Bienvenue sur le framework **DRY API**. Ce guide va t'aider à installer et lancer ton premier projet en moins de 5 minutes.

## 📋 Prérequis

Avant de commencer, assure-toi d'avoir installé :
- **Node.js** (version 16 ou supérieure)
- **MongoDB** (doit être lancé localement ou avoir une URI distante)
- **Git** (pour le versionning)

## 🛠️ Installation

1. **Cloner le projet**
   ```bash
   git clone <ton-repo-url>
   cd dryApi
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer l'environnement**
   Copie le fichier d'exemple pour créer ton fichier de configuration :
   ```bash
   cp .env.exemple .env
   ```
   
   Ouvre le fichier `.env` et vérifie les points clés :
   - `MONGO_URI` : L'adresse de ta base de données (ex: `mongodb://localhost:27017/DryBase`)
   - `JWT_SECRET` : Une clé secrète pour sécuriser les tokens (ex: `super_secret_key_123`)

## ▶️ Lancement

### Mode Développement (Recommandé)
Ce mode redémarre automatiquement le serveur quand tu modifies un fichier.
```bash
npm run dev
```

### Mode Production
Ce mode est optimisé pour la performance et la sécurité.
```bash
npm start
```

## ✅ Vérification

Une fois lancé, ouvre ton navigateur :
- **API Status** : [http://localhost:5000/](http://localhost:5000/) (Doit afficher "API Running...")
- **Documentation Swagger** : [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

---

## ⏭️ Prochaine étape
Maintenant que le serveur tourne, apprends à **[Créer ta première Application](./02_DEVELOPER_GUIDE.md)** !
