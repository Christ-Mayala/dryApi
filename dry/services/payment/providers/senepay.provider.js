const crypto = require('crypto');
const BaseProvider = require('./base.provider');

/**
 * SenePay Provider — Agrégateur Mobile Money Afrique (14 pays)
 * Docs : https://api.sene-pay.com
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  PAYIN  → camelCase  (orderReference, successUrl…)  │
 * │  PAYOUT → snake_case (external_id, callback_url…)   │
 * │  Opérateurs → minuscules sans underscore            │
 * │  (wave, orange, mtn, moov, free, airtel, mpesa…)    │
 * └─────────────────────────────────────────────────────┘
 *
 * Variables d'environnement requises :
 *   SENEPAY_API_KEY              → X-Api-Key  (pk_live_* ou pk_test_*)
 *   SENEPAY_API_SECRET           → X-Api-Secret (sk_live_* ou sk_test_*)
 *   SENEPAY_WEBHOOK_SECRET       → whsec_* (signature HMAC-SHA256 webhooks)
 *   SENEPAY_WEBHOOK_URL          → URL de callback globale (optionnel)
 */

const BASE_URL = 'https://api.sene-pay.com';

class SenePayProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.apiKey    = config.apiKey    || process.env.SENEPAY_API_KEY;
    this.apiSecret = config.apiSecret || process.env.SENEPAY_API_SECRET;
    this.webhookSecret = config.webhookSecret || process.env.SENEPAY_WEBHOOK_SECRET;

    if (!this.apiKey || !this.apiSecret) {
      this.log('SenePay : SENEPAY_API_KEY ou SENEPAY_API_SECRET manquant', 'warning');
    }
  }

  // ─────────────────────────────────────────
  // UTILITAIRES INTERNES
  // ─────────────────────────────────────────

  /** Headers communs à toutes les requêtes */
  _headers() {
    return {
      'Content-Type': 'application/json',
      'X-Api-Key':    this.apiKey,
      'X-Api-Secret': this.apiSecret,
    };
  }

  /** fetch interne avec gestion d'erreur unifiée */
  async _request(method, path, body = null) {
    const url = `${BASE_URL}${path}`;
    const options = { method, headers: this._headers() };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Format préféré : { code, message } — fallback : { error }
      const msg = data.message || data.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.httpStatus = res.status;
      err.code = data.code || 'SENEPAY_ERROR';
      err.raw = data;
      throw err;
    }
    return data;
  }

  // ─────────────────────────────────────────
  // PAYIN — CHECKOUT HÉBERGÉ (Méthode A)
  // ─────────────────────────────────────────

  /**
   * Crée une session de paiement Checkout hébergée.
   * Le client est redirigé vers checkout.sene-pay.com.
   *
   * @param {Object} params
   * @param {number}  params.amount           - Montant (min 200)
   * @param {string}  params.currency         - XOF | XAF | GNF | CDF | GMD | USD
   * @param {string}  params.orderReference   - Référence commande côté marchand
   * @param {string}  [params.country]        - Code ISO pays (ex: "SN") — fixe le pays
   * @param {string}  [params.description]    - Description affichée au client
   * @param {string}  [params.successUrl]     - Redirection après succès
   * @param {string}  [params.cancelUrl]      - Redirection en cas d'annulation
   * @param {string}  [params.webhookUrl]     - URL webhook pour cet ordre
   * @param {Object}  [params.metadata]       - Données libres renvoyées dans le webhook
   * @param {number}  [params.expiresInMinutes] - Durée validité session (défaut 30 min)
   * @returns {Promise<{success, sessionToken, checkoutUrl, status, expiresAt, raw}>}
   */
  async createCheckoutSession({
    amount, currency, orderReference, country,
    description, successUrl, cancelUrl, webhookUrl,
    metadata, expiresInMinutes,
  }) {
    try {
      const payload = {
        amount,
        currency,
        orderReference,
        ...(country          && { country }),
        ...(description      && { description }),
        ...(successUrl       && { successUrl }),
        ...(cancelUrl        && { cancelUrl }),
        ...(webhookUrl       && { webhookUrl }),
        ...(metadata         && { metadata }),
        ...(expiresInMinutes && { expiresInMinutes }),
      };

      const data = await this._request('POST', '/api/v1/checkout/sessions', payload);

      this.log(`Checkout session créée : ${data.sessionToken} (${orderReference})`, 'info');
      return {
        success:      true,
        sessionToken: data.sessionToken,
        checkoutUrl:  data.checkoutUrl,
        status:       data.status,       // "Open"
        expiresAt:    data.expiresAt,
        raw:          data,
      };
    } catch (err) {
      this.log(`Checkout session erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  /**
   * Vérifie le statut d'une session Checkout.
   *
   * Statuts possibles : Open | Processing | Complete | Failed | Cancelled | Expired
   *
   * @param {string} sessionToken - Token retourné par createCheckoutSession
   * @returns {Promise<{success, status, payment, raw}>}
   */
  async getCheckoutStatus(sessionToken) {
    try {
      const data = await this._request('GET', `/api/v1/checkout/sessions/${sessionToken}`);
      return {
        success: true,
        status:  data.status,
        payment: data.payment || null,  // présent si status === "Complete"
        raw:     data,
      };
    } catch (err) {
      this.log(`Checkout status erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  // ─────────────────────────────────────────
  // PAYIN — API DIRECT (Méthode B)
  // ─────────────────────────────────────────

  /**
   * Initie un paiement Direct (sans page checkout).
   * Le client reste sur votre interface.
   *
   * nextAction guide l'UX :
   *   REDIRECT_TO_PROVIDER_LINK → Wave : rediriger vers redirectUrl
   *   USSD_PUSH                 → MTN/Moov/Free : afficher "Confirmez sur téléphone"
   *   OTP_REQUIRED              → Orange : demander OTP USSD au client, puis re-appeler avec otpCode
   *   NONE                      → Terminé (status Failed/Completed/Cancelled)
   *
   * @param {Object} params
   * @param {number}  params.amount          - Montant (min 200)
   * @param {string}  params.countryCode     - SN | CI | BF | ML | CM | GN | BJ | TG | NE | GA | CG | CD…
   * @param {string}  params.operator        - wave | orange | mtn | moov | free | airtel | tmoney | mpesa
   * @param {string}  params.customerPhone   - Numéro international (ex: "+221770000001")
   * @param {string}  [params.currency]      - XOF (défaut)
   * @param {string}  [params.orderId]       - Référence commande
   * @param {string}  [params.customerName]  - Nom du client
   * @param {string}  [params.otpCode]       - OTP requis pour Orange (2e appel)
   * @param {string}  [params.returnUrl]     - URL retour Wave
   * @param {string}  [params.webhookUrl]    - Webhook spécifique à ce paiement
   * @param {Object}  [params.metadata]      - Données libres
   * @returns {Promise<{success, token, status, nextAction, redirectUrl, otpRequired, raw}>}
   */
  async initiateDirectPayment({
    amount, countryCode, operator, customerPhone, currency = 'XOF',
    orderId, customerName, otpCode, returnUrl, cancelUrl, webhookUrl, metadata,
  }) {
    try {
      const payload = {
        amount,
        currency,
        countryCode,
        operator,
        customerPhone,
        ...(orderId      && { orderId }),
        ...(customerName && { customerName }),
        ...(otpCode      && { otpCode }),
        ...(returnUrl    && { returnUrl }),
        ...(cancelUrl    && { cancelUrl }),
        ...(webhookUrl   && { webhookUrl }),
        ...(metadata     && { metadata }),
      };

      const data = await this._request('POST', '/api/v1/payments/initiate', payload);

      // ⚠️ SenePay retourne HTTP 200 même en cas d'échec provider
      // Toujours inspecter `status`, pas `statut`
      this.log(
        `Direct payin : ${data.status} | nextAction=${data.nextAction} | token=${data.token}`,
        data.status === 'Failed' ? 'warning' : 'info'
      );

      return {
        success:     data.status !== 'Failed' && data.status !== 'Cancelled',
        token:       data.token,
        internalId:  data.internalId,
        status:      data.status,
        nextAction:  data.nextAction,
        redirectUrl: data.redirectUrl || null,
        otpRequired: data.otpRequired || false,
        failedReason: data.failedReason || null,
        errorCode:   data.errorCode || null,
        raw:         data,
      };
    } catch (err) {
      this.log(`Direct payin erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  /**
   * Vérifie le statut d'un paiement direct.
   * Statuts : Pending | Completed | Failed | Cancelled
   *
   * @param {string} token - Token retourné par initiateDirectPayment
   */
  async getDirectPaymentStatus(token) {
    try {
      const data = await this._request('GET', `/api/v1/${token}/status`);
      return {
        success: true,
        status:  data.status,
        amount:  data.amount,
        fees:    data.totalFee,
        netAmount: data.creditedAmount,
        raw:     data,
      };
    } catch (err) {
      this.log(`Direct payin status erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  // ─────────────────────────────────────────
  // COMPATIBILITÉ BaseProvider
  // ─────────────────────────────────────────

  /**
   * Implémentation BaseProvider.initPayment
   * Utilise le Checkout hébergé par défaut.
   */
  async initPayment({ amount, currency, transactionId, description, successUrl, cancelUrl, webhookUrl, metadata }) {
    return this.createCheckoutSession({
      amount,
      currency: currency || 'XOF',
      orderReference: transactionId,
      description,
      successUrl,
      cancelUrl,
      webhookUrl: webhookUrl || process.env.SENEPAY_WEBHOOK_URL,
      metadata,
    });
  }

  /**
   * Implémentation BaseProvider.verifyPayment
   * Vérifie une session Checkout par son sessionToken.
   */
  async verifyPayment(sessionToken) {
    return this.getCheckoutStatus(sessionToken);
  }

  // ─────────────────────────────────────────
  // PAYOUT — ENVOI D'ARGENT
  // ─────────────────────────────────────────

  /**
   * Envoie de l'argent vers un bénéficiaire mobile money.
   * ⚠️ Payout utilise snake_case — respecter strictement la convention.
   *
   * fee_mode : auto (défaut) | on_top | inclusive
   *   on_top    → frais en plus (bénéficiaire reçoit montant exact)
   *   inclusive → frais inclus (bénéficiaire reçoit montant − frais)
   *   auto      → on_top si solde suffisant, sinon inclusive
   *
   * @param {Object} params
   * @param {number}  params.amount           - Montant (min 200, max 5 000 000)
   * @param {string}  params.phone            - Numéro bénéficiaire avec indicatif (ex: "221771234567")
   * @param {string}  params.country          - SN | CI | ML | BF | CM | GN…
   * @param {string}  params.operator         - wave | orange | mtn | moov | free | airtel | mpesa…
   * @param {string}  [params.external_id]    - ID idempotence côté marchand (recommandé)
   * @param {string}  [params.recipient_name] - Nom bénéficiaire
   * @param {string}  [params.type]           - refund | seller_payment | salary | commission…
   * @param {string}  [params.description]    - Description visible dans le dashboard
   * @param {string}  [params.callback_url]   - Webhook payout
   * @param {Object}  [params.metadata]       - Données libres (string→string)
   * @param {string}  [params.fee_mode]       - auto | on_top | inclusive
   * @returns {Promise<{success, disbursement_id, status, amount_debited, net_amount, fees, raw}>}
   */
  async createPayout({
    amount, phone, country, operator, external_id,
    recipient_name, type, description, callback_url, metadata, fee_mode,
  }) {
    try {
      const payload = {
        amount,
        phone,
        country,
        operator,
        ...(external_id    && { external_id }),
        ...(recipient_name && { recipient_name }),
        ...(type           && { type }),
        ...(description    && { description }),
        ...(callback_url   && { callback_url }),
        ...(metadata       && { metadata }),
        ...(fee_mode       && { fee_mode }),
      };

      const data = await this._request('POST', '/api/v1/payouts', payload);

      this.log(`Payout créé : ${data.disbursement_id} | ${data.status}`, 'info');
      return {
        success:        data.success,
        disbursement_id: data.disbursement_id,
        external_id:    data.external_id,
        status:         data.status,
        amount_debited: data.amount_debited,
        net_amount:     data.net_amount,
        fees:           data.fees,
        fee_mode:       data.fee_mode,
        raw:            data,
      };
    } catch (err) {
      this.log(`Payout erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  /**
   * Récupère le statut d'un payout.
   * {id} accepte disbursement_id (préfixé DISB_) ou external_id.
   *
   * @param {string} id - disbursement_id ou external_id
   */
  async getPayoutStatus(id) {
    try {
      const data = await this._request('GET', `/api/v1/payouts/${id}`);
      return { success: true, status: data.status, raw: data };
    } catch (err) {
      this.log(`Payout status erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  /**
   * Envoi en lot — max 100 bénéficiaires par requête.
   *
   * @param {Object} params
   * @param {string}   params.external_id   - ID idempotence du lot
   * @param {string}   params.callback_url  - Webhook (un appel par item)
   * @param {Array}    params.disbursements  - Tableau de payouts (même schéma que createPayout)
   */
  async createBatchPayout({ external_id, callback_url, disbursements }) {
    try {
      const data = await this._request('POST', '/api/v1/payouts/batch', {
        external_id, callback_url, disbursements,
      });
      this.log(`Batch payout créé : ${data.batch_id} (${data.total_count} items)`, 'info');
      return { success: true, batch_id: data.batch_id, status: data.status, raw: data };
    } catch (err) {
      this.log(`Batch payout erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  /**
   * Consulte le solde du wallet marchand.
   */
  async getWalletBalance() {
    try {
      const data = await this._request('GET', '/api/v1/merchant/wallet/balance');
      return { success: true, balance: data.data?.balance, currency: data.data?.currency, raw: data };
    } catch (err) {
      this.log(`Wallet balance erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  /**
   * Estime les frais d'un payout avant envoi.
   *
   * @param {number} amount   - Montant
   * @param {string} country  - Code pays
   * @param {string} operator - Code opérateur
   */
  async estimatePayout({ amount, country, operator }) {
    try {
      const data = await this._request('POST', '/api/v1/payouts/estimate', { amount, country, operator });
      return { success: true, estimate: data.estimate, raw: data };
    } catch (err) {
      this.log(`Estimate payout erreur : ${err.message}`, 'error');
      return { success: false, error: err.message, code: err.code };
    }
  }

  // ─────────────────────────────────────────
  // WEBHOOK — VÉRIFICATION SIGNATURE
  // ─────────────────────────────────────────

  /**
   * Vérifie la signature HMAC-SHA256 d'un webhook SenePay.
   *
   * ⚠️ IMPORTANT :
   *   - Calculer le HMAC sur le CORPS BRUT (Buffer/string avant JSON.parse)
   *   - Utiliser webhookSigningSecret (whsec_*), JAMAIS apiSecret
   *
   * @param {string|Buffer} rawBody   - Corps brut de la requête
   * @param {string}        signature - Header X-SenePay-Signature
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!this.webhookSecret) {
      this.log('SENEPAY_WEBHOOK_SECRET manquant — vérification impossible', 'error');
      return false;
    }
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
    return signature === expected;
  }
}

module.exports = SenePayProvider;
