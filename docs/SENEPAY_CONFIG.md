# Configuration SenePay — Trivida

## Dashboard SenePay (à configurer sur https://dashboard.sene-pay.com)

### URL Webhook (notifications de paiement confirmé)
```
https://dryapi.onrender.com/api/v1/senepay/webhooks/payin
```
> SenePay envoie un POST ici après chaque paiement confirmé.
> Cette route active le plan Premium sur l'utilisateur et envoie le reçu par email.

### URL de succès (redirection après paiement sur la page checkout)
```
https://dryapi.onrender.com/payment/callback
```
> Le serveur redirige ensuite l'utilisateur vers l'app mobile via deep link :
> `com.christ_mayala.trivida://payment/callback`

---

## Variables d'environnement (.env sur Render)

```env
# SenePay Production (remplacer les clés sandbox pk_test_ / sk_test_ par les clés prod)
SENEPAY_API_KEY=pk_live_XXXXXXXXXXXXXXXX
SENEPAY_API_SECRET=sk_live_XXXXXXXXXXXXXXXX
SENEPAY_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXX
SENEPAY_WEBHOOK_URL=https://dryapi.onrender.com/api/v1/senepay/webhooks/payin
```

> Les clés `pk_live_` / `sk_live_` / `whsec_` se trouvent dans le dashboard SenePay
> → section **Développeurs** → **Clés API** → mode **Production**

---

## Clés Sandbox (développement local uniquement)

```env
SENEPAY_API_KEY=pk_test_9vx5GYAlih6qSxWx4iaXesfg
SENEPAY_API_SECRET=sk_test_n16pVZ1ZCpvUkF78OlGZDhNWru3GltvE
SENEPAY_WEBHOOK_SECRET=whsec_KxSeiMOcLfpXwiGTgaNPhSHUvWGlotHl4A9R6j3y
SENEPAY_WEBHOOK_URL=https://dryapi.onrender.com/api/v1/senepay/webhooks/payin
```

### Numéros de test sandbox — Congo (CG)
| Numéro | Résultat simulé |
|--------|----------------|
| `60000001` | ✅ Succès |
| `60000002` | ⏳ En attente |
| `60000003` | ❌ Échec |

---

## Routes senepay exposées

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/senepay/checkout/session` | Créer session de paiement |
| GET  | `/api/v1/senepay/checkout/:token` | Statut d'une session |
| POST | `/api/v1/senepay/checkout/:token/activate` | Vérifier ET activer le plan |
| POST | `/api/v1/senepay/webhooks/payin` | Webhook SenePay (HMAC-SHA256) |
| GET  | `/payment/callback` | Redirection deep link après paiement |

---

## Flux paiement production

```
1. Mobile → POST /api/v1/senepay/checkout/session
2. Serveur → SenePay createCheckoutSession → checkoutUrl
3. Mobile → Linking.openURL(checkoutUrl) [ouvre Chrome]
4. Utilisateur paie sur checkout.sene-pay.com
5. SenePay → POST /api/v1/senepay/webhooks/payin (activation plan)
6. SenePay → redirect vers https://dryapi.onrender.com/payment/callback
7. Serveur → 302 vers com.christ_mayala.trivida://payment/callback
8. App mobile → Linking event → verifyPayment() → setShowSuccess(true)
```

## Flux paiement dev (sandbox local)

```
1-4. Identique (mais avec clés sandbox)
5. Webhook NE PEUT PAS atteindre localhost → ignoré
6. Utilisateur revient dans l'app (bouton Retour Android)
7. Alert "Avez-vous confirmé le paiement ?" → Oui
8. POST /activate avec forceSandbox: true → activation directe
```
