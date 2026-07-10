# 🔄 Réactivation de Google OAuth

## Contexte

Google OAuth a été **temporairement désactivé** dans l'API dryApi parce que la connexion Google redirigeait vers Spirit au lieu de Trivida.

## Fichiers modifiés

| Fichier | Modification | Statut |
|---------|-------------|--------|
| `dry/modules/auth/auth.routes.js` | 3 routes Google commentées | ⬜ À réactiver |
| `dry/modules/user/socialAuth.routes.js` | Routes `/google` et `/google/callback` commentées | ⬜ À réactiver |
| `dry/bootstrap/routes.js` | Import et montage de `googleAuthRoutes` commentés | ⬜ À réactiver |
| `dry/core/plugins/passport.plugin.js` | `GoogleStrategy` et sa config commentés | ⬜ À réactiver |
| `dry/core/application/bootloader.js` | Log mis à jour (Facebook seulement) | ✅ Déjà OK |

---

## 📋 Procédure de réactivation

### 1. `dry/core/plugins/passport.plugin.js`

**a)** Décommenter l'import de GoogleStrategy :
```js
// Avant (commenté) :
// const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Après (actif) :
const GoogleStrategy = require('passport-google-oauth20').Strategy;
```

**b)** Décommenter tout le bloc Google OAuth (chercher le marqueur `// ─── Google OAuth — COMMENTÉ ───` jusqu'à `// ─── Fin Google OAuth COMMENTÉ ───`) :
```js
const googleClientId = config.GOOGLE_CLIENT_ID;
const googleClientSecret = config.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = buildCallbackUrl(config.GOOGLE_CALLBACK_URL, '/api/auth/google/callback');

if (isConfigured(googleClientId) && isConfigured(googleClientSecret)) {
  passport.use(
    new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackUrl,
      state: false,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const appName = resolveTenantAppName(req);
        if (!appName) {
          return done(new Error('Tenant manquant: utilise /api/auth/google?app=SCIM (ou autre).'), false);
        }
        const user = await upsertGoogleUser(appName, profile);
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    })
  );
} else {
  console.warn('[passport] Google OAuth desactive: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants.');
}
```

**c)** Supprimer la ligne `console.log('[passport] Google OAuth volontairement désactivé (commenté).');`

---

### 2. `dry/modules/auth/auth.routes.js`

Décommenter **tout le fichier** (remplacer par la version originale) :
```js
const express = require('express');
const passport = require('passport');
const { signAccessToken, signRefreshToken } = require('../../utils/auth/jwt.util');

const router = express.Router();

router.get('/auth/google', (req, res, next) => { /* ... */ });
router.get('/auth/google/callback', /* ... */);
router.get('/auth/google/failure', (req, res) => { /* ... */ });

module.exports = router;
```

---

### 3. `dry/modules/user/socialAuth.routes.js`

Décommenter les 2 routes Google (chercher `// ─── Google OAuth — COMMENTÉ ───`) :
```js
// Google OAuth
router.get('/google', (req, res, next) => { /* ... */ });
router.get('/google/callback', (req, res, next) => { /* ... */ });

// Facebook OAuth
```

---

### 4. `dry/bootstrap/routes.js`

Décommenter l'import et le montage :
```js
const googleAuthRoutes = require('../modules/auth/auth.routes');

// Dans registerApplicationRoutes() :
app.use('/api', googleAuthRoutes);
```

---

### 5. Variables d'environnement requises

Vérifier que ces variables sont définies dans `.env` ou la config :
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (ex: `https://api.mondomaine.com/api/auth/google/callback`)

---

### ✅ Test après réactivation

```bash
# Démarrer le serveur
node server.js

# Tester le flux Google OAuth
curl -v "http://localhost:5000/api/auth/google?app=trivida&redirect_uri=com.christ_mayala.trivida://oauth/callback"
```
