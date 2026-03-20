# 🚀 Guide de Déploiement (Production Hardening)

Mettre une API en ligne est une responsabilité. Ce guide t'assure que ton déploiement est **sécurisé**, **rapide** et **auto-reparable**.

---

## 1. Préparation de l'Environnement (Standard Industriel) 🛡️

En production, ton fichier `.env` doit être durci :

```bash
NODE_ENV=production
# Sécurité
JWT_SECRET=GENERER_UNE_CLE_DE_64_CHAR_MINIMUM
# Base de données (Utilise MongoDB Atlas pour la réplication)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/DryMain
# Origins autorisées (Ne jamais laisser *)
ALLOWED_ORIGINS=https://mon-app.com,https://admin.mon-app.com
```

---

## 2. Hardening (Sécurité Maximale) 🔒

DRY active automatiquement ces protections en mode production :
- **HSTS (HTTP Strict Transport Security)** : Force le HTTPS.
- **CSP (Content Security Policy)** : Bloque les scripts malveillants (XSS).
- **Rate Limiting Hardened** : Réduit le nombre de requêtes autorisées par minute pour prévenir les attaques par déni de service (DoS).
- **Hide Powered-By** : Supprime les en-têtes qui indiquent l'onglet technologique (Express).

---

## 3. Déploiement sur Cloud (Render, Vercel, Railway) ☁️

### Recommandation : Render.com
1.  **Crée un "Web Service"**.
2.  Connecte ton repo GitHub.
3.  **Build Command** : `npm install`
4.  **Start Command** : `npm start`
5.  Ajoute tes variables d'environnement (`.env`).

### Pourquoi Render ?
Le système de **Surgical Alerting** est optimisé pour Render. Si ton API sature sa mémoire ou crash, Render la redémarrera instantanément, et tu recevras le rapport complet de l'erreur par mail juste avant le redémarrage.

---

## 4. Monitoring & Santé Continue 🚑

Une fois déployée, ton API se surveille elle-même.
- **Health Check** : Configure un outil comme `UptimeRobot` sur `https://ton-api.com/status`.
- **Alertes** : Assure-toi que `ALERT_EMAIL_TO` est bien configuré pour recevoir les notifications "Chirurgicales".

---

## 💡 Astuce de Scalabilité
Si ton trafic explose, tu n'as pas besoin de recoder. Augmente simplement le nombre d'instances (Scaling horizontal) sur ton hébergeur. Le Kernel de DRY est **stateless**, ce qui signifie qu'il peut tourner sur 100 serveurs en même temps sans conflit.

---
*Déployer, c'est bien. Déployer en toute confiance, c'est mieux.*
