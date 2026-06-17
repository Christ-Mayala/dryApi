# SenePay — Mobile Money Afrique

Intégration de l'agrégateur de paiement **SenePay** dans le framework DRY.
14 pays africains supportés — Payin (Checkout + Direct) + Payout + Webhooks.

---

## Variables d'environnement

```env
SENEPAY_API_KEY=pk_test_...          # Clé publique  (sandbox: pk_test_* | prod: pk_live_*)
SENEPAY_API_SECRET=sk_test_...       # Clé secrète   (sandbox: sk_test_* | prod: sk_live_*)
SENEPAY_WEBHOOK_SECRET=whsec_...     # Signature HMAC webhooks (≠ API secret)
SENEPAY_WEBHOOK_URL=https://...      # URL webhook globale (optionnel)
```

> **Important :** `SENEPAY_WEBHOOK_SECRET` est différent de `SENEPAY_API_SECRET`.
> Il est préfixé `whsec_` et sert uniquement à vérifier la signature des webhooks.

---

## Conventions de l'API SenePay

| API | Convention | Exemple |
|-----|-----------|---------|
| Payin Checkout | `camelCase` | `orderReference`, `successUrl` |
| Payin Direct | `camelCase` | `countryCode`, `customerPhone` |
| Payout | `snake_case` | `external_id`, `callback_url` |
| Codes opérateurs | minuscules | `wave`, `orange`, `mtn`, `moov` |

---

## Routes disponibles

Base : `/api/v1/senepay`

### Payin — Checkout hébergé

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/checkout/session` | JWT | Créer une session de paiement |
| `GET` | `/checkout/:token` | JWT | Statut d'une session |

### Payin — Direct (sans redirection)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/pay` | JWT | Initier un paiement direct |
| `GET` | `/pay/:token/status` | JWT | Statut d'un paiement direct |

### Payout

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/payout` | JWT + admin | Envoi simple |
| `POST` | `/payout/batch` | JWT + admin | Envoi en lot (max 100) |
| `GET` | `/payout/:id` | JWT | Statut d'un payout |
| `POST` | `/payout/estimate` | JWT | Estimer les frais |

### Wallet

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/wallet/balance` | JWT + admin | Solde wallet marchand |

### Webhooks (pas de JWT — vérification HMAC)

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/webhooks/payin` | Événements paiement |
| `POST` | `/webhooks/payout` | Événements décaissement |

---

## Exemples d'utilisation

### 1. Créer une session Checkout

```js
// POST /api/v1/senepay/checkout/session
{
  "amount": 10000,
  "currency": "XOF",
  "orderReference": "CMD-2026-001",
  "country": "SN",
  "successUrl": "https://ton-site.com/success",
  "cancelUrl": "https://ton-site.com/cancel",
  "webhookUrl": "https://dryapi.onrender.com/api/v1/senepay/webhooks/payin",
  "metadata": { "userId": "abc123" }
}

// Réponse
{
  "success": true,
  "sessionToken": "chk_abc123",
  "checkoutUrl": "https://api.sene-pay.com/checkout.html?session=chk_abc123",
  "status": "Open",
  "expiresAt": "2026-06-07T15:00:00Z"
}
// → Rediriger le client vers checkoutUrl
```

### 2. Paiement Direct (Wave → redirection)

```js
// POST /api/v1/senepay/pay
{
  "amount": 5000,
  "currency": "XOF",
  "countryCode": "SN",
  "operator": "wave",
  "customerPhone": "+221700000001",
  "orderId": "CMD-2026-002"
}

// Réponse
{
  "nextAction": "REDIRECT_TO_PROVIDER_LINK",
  "redirectUrl": "https://pay.wave.com/...",
  "token": "afp_tx_xyz"
}
// → Rediriger vers redirectUrl
```

### 3. Paiement Direct (Orange → OTP requis)

```js
// Étape 1 — sans otpCode
// POST /api/v1/senepay/pay
{ "amount": 5000, "countryCode": "SN", "operator": "orange", "customerPhone": "+221771234567" }
// → nextAction: "OTP_REQUIRED" → afficher "Composez #144#391# sur votre téléphone"

// Étape 2 — avec otpCode
{ "amount": 5000, "countryCode": "SN", "operator": "orange", "customerPhone": "+221771234567", "otpCode": "12345678" }
// → nextAction: "USSD_PUSH" → afficher spinner, poller le statut
```

### 4. Paiement Direct (MTN/Moov → USSD Push)

```js
// POST /api/v1/senepay/pay
{ "amount": 5000, "countryCode": "SN", "operator": "mtn", "customerPhone": "+221770000001" }
// → nextAction: "USSD_PUSH" → afficher "Confirmez sur votre téléphone"

// Polling statut toutes les 3-5 secondes
// GET /api/v1/senepay/pay/afp_tx_xyz/status
// Statuts : Pending → Completed | Failed | Cancelled
```

### 5. Payout simple

```js
// POST /api/v1/senepay/payout  (admin requis)
{
  "amount": 25000,
  "phone": "221771234567",
  "country": "SN",
  "operator": "wave",
  "external_id": "PAY-2026-001",
  "recipient_name": "Amadou Diallo",
  "type": "seller_payment",
  "description": "Commission Mai 2026"
}
```

### 6. Payout en lot

```js
// POST /api/v1/senepay/payout/batch  (admin requis)
{
  "external_id": "BATCH-2026-001",
  "disbursements": [
    { "amount": 15000, "phone": "221771111111", "country": "SN", "operator": "wave", "external_id": "P-001" },
    { "amount": 25000, "phone": "22507123456",  "country": "CI", "operator": "mtn",  "external_id": "P-002" }
  ]
}
```

---

## Flux nextAction

```
POST /pay
  │
  ├─ nextAction: REDIRECT_TO_PROVIDER_LINK → rediriger vers redirectUrl (Wave)
  │
  ├─ nextAction: USSD_PUSH → afficher spinner, poller GET /pay/:token/status
  │
  ├─ nextAction: OTP_REQUIRED → demander OTP USSD au client
  │     └─ re-appeler POST /pay avec otpCode → USSD_PUSH
  │
  └─ nextAction: NONE → terminé (lire status + failedReason)
```

---

## Statuts

### Payin Checkout
`Open` → `Processing` → `Complete` | `Failed` | `Cancelled` | `Expired`

### Payin Direct
`Pending` → `Completed` | `Failed` | `Cancelled`

### Payout
`pending` → `processing` → `submitted` → `completed` | `failed` | `cancelled`

> `pending_verification` = issue indéterminée (timeout provider) — **ne pas traiter comme échec**.
> Attendre `completed` ou `failed` confirmé via webhook ou GET.

---

## Webhooks

Les webhooks sont signés **HMAC-SHA256** avec `SENEPAY_WEBHOOK_SECRET`.
La signature est dans le header `X-SenePay-Signature`.

### Événements Payin → `POST /api/v1/senepay/webhooks/payin`
- `checkout.session.completed` — paiement réussi
- `checkout.session.failed` — paiement échoué

### Événements Payout → `POST /api/v1/senepay/webhooks/payout`
- `disbursement.completed` — fonds reçus par le bénéficiaire
- `disbursement.failed` — échec (wallet automatiquement re-crédité)

> Toujours répondre **200 OK** rapidement — SenePay réessaie 3x (~1s, ~5s, ~30s) si non-2xx.

---

## Pays et opérateurs supportés

| Pays | Code | Devise | Opérateurs |
|------|------|--------|-----------|
| Sénégal | SN | XOF | wave, orange, free, expresso |
| Côte d'Ivoire | CI | XOF | wave, orange, mtn, moov |
| Mali | ML | XOF | wave, orange, moov |
| Burkina Faso | BF | XOF | wave, orange, moov |
| Cameroun | CM | XAF | mtn, orange |
| Guinée | GN | GNF | orange, mtn |
| Bénin | BJ | XOF | mtn, moov |
| Togo | TG | XOF | tmoney, moov |
| Niger | NE | XOF | orange, moov |
| Gabon | GA | XAF | airtel, moov |
| Congo (Brazza) | CG | XAF | mtn, airtel |
| R.D. Congo | CD | CDF | orange, airtel, mpesa |
| Centrafrique | CF | XAF | orange |
| Tchad | TD | XAF | airtel, moov |

---

## Sandbox — Numéros de test

| Numéro complet | Résultat |
|----------------|---------|
| `221700000001` | Succès (Complete) |
| `221700000002` | En attente (Processing → Complete après 10s) |
| `221700000003` | Échec (Failed) |

OTP test : n'importe quel code à 6 chiffres sauf `000000`, `111111`, `222222`, `333333`, `444444`.

---

## Modèle tarifaire

- **Payin** : 3,6% prélevé au moment de l'encaissement (1,8% payin + 1,8% réserve payout)
- **Payout** : 0% commission SenePay + ~2,5% frais provider mobile money

`fee_mode` sur les payouts :
- `on_top` → frais en plus (bénéficiaire reçoit le montant exact)
- `inclusive` → frais inclus (bénéficiaire reçoit montant − frais)
- `auto` (défaut) → on_top si solde suffisant, sinon inclusive
