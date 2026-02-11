# 🚀 Guide de Déploiement (Production)

Ton application fonctionne en local ? Voici comment la mettre en ligne de manière sécurisée et robuste.

## 📋 Checklist Pré-Déploiement

### 1. Variables d'Environnement
Sur ton serveur (VPS, Render, Heroku, AWS...), tu DOIS définir ces variables :

- **`NODE_ENV`** : `production`
  - *Pourquoi ?* Active les optimisations de performance, cache les messages d'erreur détaillés, active la sécurité stricte.
- **`MONGO_URI`** : L'adresse de ta base de production (sécurisée avec mot de passe).
- **`JWT_SECRET`** : Une chaîne très longue et aléatoire (ex: 64 caractères). Ne réutilise PAS celle de dev.
- **`ALLOWED_ORIGINS`** : La liste des sites autorisés à appeler ton API (ex: `https://monsite.com,https://admin.monsite.com`).

### 2. Sécurité
- **HTTPS** : Obligatoire. N'expose jamais ton API en HTTP simple.
- **Port** : En production, l'application écoute souvent sur un port interne (ex: 5000) derrière un Reverse Proxy (Nginx, Apache).

## 🐳 Déploiement avec Docker (Optionnel)
Si tu utilises Docker, voici un exemple de `Dockerfile` optimisé :

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔄 Mise à jour de l'application
Quand tu modifies ton code et que tu le pousses en prod :

1. `git pull` (Récupérer le code)
2. `npm install` (Si tu as ajouté des libs)
3. `npm start` (ou redémarrer le processus PM2)

## 🛠️ Utiliser PM2 (Recommandé sur VPS)
PM2 permet de garder ton application en vie même si elle plante.

```bash
# Installation
npm install -g pm2

# Lancement
pm2 start server.js --name "dry-api"

# Voir les logs
pm2 logs

# Monitoring
pm2 monit
```

---

**Félicitations !** Tu as maintenant une API professionnelle, documentée et prête pour le monde réel. 🌍
