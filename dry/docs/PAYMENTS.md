# 💳 Guide de Configuration Ultime : Paiements & Environnement

Ce guide explique étape par étape comment configurer chaque agrégateur de paiement pour rendre votre application DRY **Production Ready**.

---

## 🔐 1. Sécurité & Bonnes Pratiques

**Règle d'or** : Ne JAMAIS commiter votre fichier `.env` ou écrire vos clés API en dur dans le code.

1.  Copiez `.env.example` vers `.env` (qui est ignoré par git).
2.  Remplissez les variables ci-dessous.
3.  Utilisez `process.env.VARIABLE` dans votre code.

---

## 🌍 2. Configuration des Agrégateurs (Step-by-Step)

### A. CinetPay (Mobile Money & CB - Afrique)

CinetPay est le standard pour accepter Orange Money, MTN MoMo, etc. au Congo, Côte d'Ivoire, Cameroun, etc.

**Étape 1 : Obtenir les clés**
1.  Créez un compte sur [cinetpay.com](https://cinetpay.com).
2.  Allez dans le Dashboard > Intégration > Clés API.
3.  Récupérez `API Key` et `Site ID`.

**Étape 2 : Configurer .env**
```env
CINETPAY_API_KEY=1234567890abcdef1234567890
CINETPAY_SITE_ID=123456
```

**Étape 3 : Utilisation**
Le module `cinetpay.provider.js` utilisera automatiquement ces clés.

---

### B. MTN Mobile Money (API Collection)

Pour une intégration directe sans intermédiaire.

**Étape 1 : Créer un compte Developer**
1.  Allez sur [momodeveloper.mtn.com](https://momodeveloper.mtn.com/).
2.  Inscrivez-vous et souscrivez au produit "Collection Widget".
3.  Récupérez votre `Ocp-Apim-Subscription-Key`.

**Étape 2 : Configurer .env**
```env
MTN_MOMO_SUBSCRIPTION_KEY=votre_subscription_key_primaire
MTN_MOMO_TARGET_ENV=sandbox 
# En prod, mettre: mtncongo
```

---

### C. Airtel Money (OpenAPI)

**Étape 1 : Contacter Airtel Business**
L'accès à l'API Airtel Money entreprise nécessite souvent un contrat B2B direct.

**Étape 2 : Configurer .env**
Une fois les accès reçus :
```env
AIRTEL_CLIENT_ID=votre_client_id
AIRTEL_CLIENT_SECRET=votre_client_secret
```

---

### D. Moneroo (Agrégateur de Paiement) 🚀

Moneroo.io permet d'accepter plusieurs moyens de paiement (Mobile Money, Cartes, Crypto) via une seule intégration.

**Étape 1 : Créer un compte**
1.  Allez sur [moneroo.io](https://moneroo.io/fr).
2.  Créez un compte et validez votre identité (KYC).
3.  Dans le Dashboard, récupérez votre **Secret Key** (PK_...) pour le serveur.

**Étape 2 : Configurer .env**
```env
MONEROO_API_KEY=votre_secret_key_pk_live_...
MONEROO_RETURN_URL=https://votre-site.com/api/v1/payment/callback
```

**Fonctionnement DRY** :
Le provider `moneroo.provider.js` va :
1.  Initialiser le paiement via l'API Moneroo.
2.  Rediriger l'utilisateur vers la page de paiement sécurisée Moneroo.
3.  Gérer le retour via `return_url`.

---

### E. Stripe (International)

**Étape 1 : Dashboard Stripe**
1.  Allez sur [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys).
2.  Copiez la `Secret Key` (commence par `sk_...`).

**Étape 2 : Configurer .env**
```env
STRIPE_SECRET_KEY=sk_test_51Mz...
```

---

## 🚀 3. Utilisation dans vos Applications DRY

Lorsque vous créez une application avec `npm run create-app` et activez le module **Paiement**, le système génère automatiquement :

1.  **Fichier** : `dryApp/NomApp/features/payment/controller/payment.controller.js`
2.  **Routes** : `POST /api/v1/nomapp/payment/init`

**Exemple d'appel depuis votre Frontend (React/Vue/Mobile) :**

```javascript
const response = await fetch('https://api.votre-domaine.com/api/v1/shop/payment/init', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer VOTRE_TOKEN_JWT'
  },
  body: JSON.stringify({
    provider: 'moneroo', // ou 'cinetpay', 'mtn', 'airtel'
    amount: 5000,
    currency: 'XAF',
    description: 'Achat Abonnement Pro',
    customerPhone: '061234567' // Requis pour Mobile Money
  })
});

const data = await response.json();

if (data.success) {
  // Rediriger l'utilisateur ou afficher le QR Code
  window.location.href = data.paymentUrl;
}
```

---

## 📊 4. Module Export & Notifications

### Export
Activé via `dry/services/export/export.service.js`.
Aucune configuration .env requise. Utilise `exceljs` et `json2csv` en interne.

### Notifications (Socket.io)
Le serveur écoute par défaut sur le port 5000.
Assurez-vous que votre Load Balancer (Nginx/AWS ALB) supporte les WebSockets.

**Test de connexion :**
```bash
wscat -c ws://localhost:5000/socket.io/?EIO=4&transport=websocket
```
