# 🚀 Démarrage Rapide (L'Expérience Google-Style)

Bienvenue sur le framework **DRY API**. Ce document est ton point d'entrée pour installer un environnement de production en quelques minutes.

---

## 📋 Prérequis Système

Assure-toi que ton environnement respecte ces standards de fiabilité :
- **Node.js** : v20.x (LTS) recommandé.
- **MongoDB** : v6.0+ (Local ou Atlas).
- **RAM** : 512MB minimum (Le kernel est optimisé pour les processeurs à 1 cœur).

---

## 🛠️ Installation Chirurgicale

1.  **Clonage du Repository**
    ```bash
    git clone <votre-repo-url>
    cd dryApi
    ```

2.  **Installation des Dépendances**
    ```bash
    npm install
    # Note: Si tu es sur Windows et que tu as des erreurs de build, installe 'windows-build-tools'.
    ```

3.  **Configuration Environnementale**
    Ne commence pas sans un fichier `.env` solide. Copie l'exemple :
    ```bash
    cp .env.exemple .env
    ```
    **Clés critiques à configurer :**
    - `MONGO_URI` : L'URL de ta base principale (utilisée pour l'admin global).
    - `JWT_SECRET` : Une chaîne de 64 caractères aléatoires (Sécurité maximale).
    - `RESEND_API_KEY` : Pour recevoir les alertes de crash par mail.

---

## ▶️ Lancement & Modes

### ⚡ Mode Développement (Agile)
Utilisé pour coder en temps réel. Le serveur redémarre à chaque modification.
```bash
npm run dev
```

### 💎 Mode Production (Robuste)
Utilise les optimisations du Kernel (HSTS, Cache durci, Compression).
```bash
npm start
```

---

## ✅ Vérification de Santé (Health Check)

Une fois le serveur lancé sur le port **5000**, effectue ces trois tests :

1.  **Status Ping** : `GET http://localhost:5000/` 
    - *Résultat attendu* : JSON avec `status: UP`.
2.  **Documentation Native** : [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
    - *Résultat attendu* : Interface Swagger chargée.
3.  **Logs de Démarrage** : Vérifie dans ton terminal qu'aucune erreur `DATABASE_CONNECTION_ERROR` n'apparaît.

---

## ⏭️ Prochaine Étape
Maintenant que ton moteur tourne, passe au **[Guide du Développeur](./02_DEVELOPER_GUIDE.md)** pour créer ta première application multi-tenant.
