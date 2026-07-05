/**
 * Routes SenePay — Mobile Money Afrique (14 pays)
 * Monté automatiquement par le bootloader sur : /api/v1/senepay
 *
 * Contexte : Congo-Brazzaville (CG) — Devise XAF — Opérateurs : mtn, airtel
 *
 * Stratégie orderReference + résolution utilisateur dans webhook :
 *   - orderReference lisible : DRY-YYYYMMDD-XXXXXX  (ex: DRY-20260607-A3F9B1)
 *   - userId stocké dans metadata.userId → retourné tel quel par SenePay dans le webhook
 *   - Zéro table DB supplémentaire, zéro parsing complexe
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  POST   /api/v1/senepay/checkout/session   Créer session     │
 * │  GET    /api/v1/senepay/checkout/:token    Statut session    │
 * │  POST   /api/v1/senepay/pay                Initier payin     │
 * │  GET    /api/v1/senepay/pay/:token/status  Statut payin      │
 * │  POST   /api/v1/senepay/payout             Envoi simple      │
 * │  POST   /api/v1/senepay/payout/batch       Envoi en lot      │
 * │  GET    /api/v1/senepay/payout/:id         Statut payout     │
 * │  POST   /api/v1/senepay/payout/estimate    Estimer frais     │
 * │  GET    /api/v1/senepay/wallet/balance     Solde wallet      │
 * │  POST   /api/v1/senepay/webhooks/payin     Webhook payin     │
 * │  POST   /api/v1/senepay/webhooks/payout    Webhook payout    │
 * └──────────────────────────────────────────────────────────────┘
 */

const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../../middlewares/protection/auth.middleware');
const sendResponse = require('../../utils/http/response');
const logger = require('../../utils/logging/logger');
const SenePayProvider = require('../../services/payment/providers/senepay.provider');
const emailService = require('../../services/auth/email.service');
const { sendAlert } = require('../../services/alert/alert.service');
const notificationService = require('../../services/notification/notification.service');
const getModel = require('../../core/factories/modelFactory');

const router = express.Router();

const DEFAULT_CURRENCY = 'XAF';
const DEFAULT_COUNTRY  = 'CG';

const senepay = new SenePayProvider({});

// ─────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────

/** Référence lisible : DRY-20260607-A3F9B1 */
const generateOrderReference = () => {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DRY-${date}-${random}`;
};

/**
 * Retrouve un utilisateur par son _id dans toutes les connexions multi-tenant.
 * Utilisé dans les webhooks après lecture de payload.metadata.userId
 */
const findUserById = async (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  const connections = mongoose.connections.filter(c => c.readyState === 1 && c.name !== 'admin');
  for (const conn of connections) {
    try {
      const User = conn.model('User');
      const user = await User.findById(userId).select('email name _id').lean();
      if (user) return user;
    } catch { /* modèle pas dispo sur cette connexion */ }
  }
  return null;
};

/** Garde : clés SenePay configurées */
const requireSenePayConfig = (req, res, next) => {
  if (!process.env.SENEPAY_API_KEY || !process.env.SENEPAY_API_SECRET) {
    return sendResponse(res, null, 'SenePay non configuré (SENEPAY_API_KEY / SENEPAY_API_SECRET manquants)', false, undefined, 503);
  }
  next();
};

// ─────────────────────────────────────────────────────────────────
// PAYIN — CHECKOUT HÉBERGÉ
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/senepay/checkout/session
 *
 * Crée une session de paiement hébergée sur checkout.sene-pay.com.
 * orderReference générée automatiquement (lisible).
 * userId injecté dans metadata → récupéré dans le webhook pour envoyer le reçu.
 *
 * Body : { amount, currency?, country?, description?,
 *          successUrl?, cancelUrl?, webhookUrl?, expiresInMinutes? }
 * Auth : JWT requis
 */
router.post('/checkout/session', requireSenePayConfig, protect, async (req, res) => {
  try {
    const {
      amount,
      currency = DEFAULT_CURRENCY,
      country  = DEFAULT_COUNTRY,
      description, successUrl, cancelUrl, webhookUrl, expiresInMinutes,
      plan, billingMode,
    } = req.body;

    if (!amount) {
      return sendResponse(res, null, 'amount est requis', false, undefined, 400);
    }

    const orderReference = generateOrderReference();
    const subscriptionDays = billingMode === 'annual' ? 365 : 30;

    const result = await senepay.createCheckoutSession({
      amount, currency, orderReference, country, description,
      successUrl, cancelUrl,
      webhookUrl: webhookUrl || process.env.SENEPAY_WEBHOOK_URL,
      expiresInMinutes,
      metadata: {
        userId:    String(req.user._id),
        userName:  req.user.name  || '',
        userEmail: req.user.email || '',
        plan:      plan || 'premium',
        billingMode: billingMode || 'monthly',
        subscriptionDays: String(subscriptionDays),
      },
    });

    if (!result.success) {
      return sendResponse(res, null, result.error || 'Échec création session', false, undefined, 400);
    }

    sendResponse(res, { ...result, orderReference }, 'Session de paiement créée');
  } catch (err) {
    logger(`[SenePay] checkout/session erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

/**
 * GET /api/v1/senepay/checkout/:token
 * Statuts : Open | Processing | Complete | Failed | Cancelled | Expired
 * Auth : JWT requis
 */
router.get('/checkout/:token', requireSenePayConfig, protect, async (req, res) => {
  try {
    const result = await senepay.getCheckoutStatus(req.params.token);
    if (!result.success) {
      return sendResponse(res, null, result.error || 'Session introuvable', false, undefined, 404);
    }
    sendResponse(res, result, 'Statut session');
  } catch (err) {
    logger(`[SenePay] checkout status erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

/**
 * POST /api/v1/senepay/checkout/:token/activate
 * Vérifie le statut ET active le plan si Complete.
 * En dev (forceSandbox=true), active même si statut = "Open".
 * Body : { plan?, billingMode?, forceSandbox? }
 * Auth : JWT requis
 */
router.post('/checkout/:token/activate', requireSenePayConfig, protect, async (req, res) => {
  try {
    const { plan = 'premium', billingMode = 'monthly', forceSandbox = false } = req.body;

    const result = await senepay.getCheckoutStatus(req.params.token);
    if (!result.success) {
      return sendResponse(res, null, result.error || 'Session introuvable', false, undefined, 404);
    }

    const status     = result.status?.toLowerCase();
    const isComplete = status === 'complete' || status === 'completed';
    const isFailed   = status === 'failed' || status === 'cancelled' || status === 'expired';

    if (isFailed) {
      return sendResponse(res, { status: result.status }, 'Paiement échoué ou annulé', false, undefined, 400);
    }

    const shouldActivate = isComplete || (forceSandbox && process.env.NODE_ENV !== 'production');

    if (shouldActivate && req.user?._id) {
      const subscriptionDays = billingMode === 'annual' ? 365 : 30;
      const premiumUntil     = new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000);
      const amount           = result.raw?.amount || 0;
      const orderReference   = result.raw?.orderReference || req.params.token;
      const transactionId    = result.raw?.payment?.transactionId || result.raw?.transactionId || null;

      const User = req.getModel ? req.getModel('User') : getModel('Trivida', 'User');
      await User.findByIdAndUpdate(req.user._id, {
        $set:  { isPremium: true, premiumPlan: plan, premiumUntil },
        $push: {
          paymentHistory: {
            $each: [{
              plan, amount, currency: result.raw?.currency || 'XAF',
              billingMode, status: 'completed',
              orderReference, transactionId,
              createdAt: new Date(),
            }],
            $slice: -50, // Garder les 50 derniers paiements max
          },
        },
      });
      logger(`[SenePay] Plan "${plan}" activé pour userId=${req.user._id} (forceSandbox=${forceSandbox})`, 'info');
      return sendResponse(res, { activated: true, plan, premiumUntil, status: result.status }, 'Plan activé');
    }

    return sendResponse(res, { activated: false, status: result.status }, 'Paiement en attente');
  } catch (err) {
    logger(`[SenePay] activate erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// PAYIN — DIRECT
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/senepay/pay
 *
 * Paiement direct sans redirection (le client reste sur votre interface).
 * Opérateurs Congo (CG) : mtn | airtel
 *
 * Body : { amount, operator, customerPhone, countryCode?, currency?,
 *          customerName?, otpCode?, returnUrl?, cancelUrl?, webhookUrl? }
 *
 * nextAction :
 *   USSD_PUSH                 → afficher spinner "Confirmez sur téléphone"
 *   OTP_REQUIRED              → demander OTP, re-appeler avec otpCode
 *   REDIRECT_TO_PROVIDER_LINK → rediriger vers redirectUrl
 *   NONE                      → terminé
 *
 * Auth : JWT requis
 */
router.post('/pay', requireSenePayConfig, protect, async (req, res) => {
  try {
    const {
      amount, operator, customerPhone,
      countryCode = DEFAULT_COUNTRY,
      currency    = DEFAULT_CURRENCY,
      customerName, otpCode, returnUrl, cancelUrl, webhookUrl,
    } = req.body;

    if (!amount || !operator || !customerPhone) {
      return sendResponse(res, null, 'amount, operator et customerPhone sont requis', false, undefined, 400);
    }

    const orderId = generateOrderReference();

    const result = await senepay.initiateDirectPayment({
      amount, currency, countryCode, operator, customerPhone,
      orderId, customerName, otpCode, returnUrl, cancelUrl,
      webhookUrl: webhookUrl || process.env.SENEPAY_WEBHOOK_URL,
      metadata: {
        userId:    String(req.user._id),
        userName:  req.user.name  || '',
        userEmail: req.user.email || '',
      },
    });

    sendResponse(res, { ...result, orderId }, result.success ? 'Paiement initié' : 'Paiement échoué');
  } catch (err) {
    logger(`[SenePay] pay erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

/**
 * GET /api/v1/senepay/pay/:token/status
 * Statuts : Pending | Completed | Failed | Cancelled
 * Polling : 1 req / 3-5s, timeout UI 90s
 * Auth : JWT requis
 */
router.get('/pay/:token/status', requireSenePayConfig, protect, async (req, res) => {
  try {
    const result = await senepay.getDirectPaymentStatus(req.params.token);
    if (!result.success) {
      return sendResponse(res, null, result.error || 'Paiement introuvable', false, undefined, 404);
    }
    sendResponse(res, result, 'Statut paiement');
  } catch (err) {
    logger(`[SenePay] pay status erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// PAYOUT
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/senepay/payout
 *
 * Body : { amount, phone, operator, country?, external_id?,
 *          recipient_name?, type?, description?, callback_url?,
 *          metadata?, fee_mode? }
 *
 * fee_mode : auto (défaut) | on_top | inclusive
 * Auth : JWT + admin
 */
router.post('/payout', requireSenePayConfig, protect, authorize('admin'), async (req, res) => {
  try {
    const {
      amount, phone, operator,
      country = DEFAULT_COUNTRY,
      external_id, recipient_name, type, description,
      callback_url, metadata, fee_mode,
    } = req.body;

    if (!amount || !phone || !operator) {
      return sendResponse(res, null, 'amount, phone et operator sont requis', false, undefined, 400);
    }

    const result = await senepay.createPayout({
      amount, phone, country, operator,
      external_id: external_id || generateOrderReference(),
      recipient_name, type, description,
      callback_url: callback_url || process.env.SENEPAY_WEBHOOK_URL,
      metadata, fee_mode,
    });

    if (!result.success) {
      return sendResponse(res, null, result.error || 'Échec payout', false, undefined, 400);
    }

    sendResponse(res, result, 'Payout initié');
  } catch (err) {
    logger(`[SenePay] payout erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

/**
 * POST /api/v1/senepay/payout/batch
 * Body : { external_id?, callback_url?, disbursements: [...] }  max 100 items
 * Auth : JWT + admin
 */
router.post('/payout/batch', requireSenePayConfig, protect, authorize('admin'), async (req, res) => {
  try {
    const { external_id, callback_url, disbursements } = req.body;

    if (!Array.isArray(disbursements) || disbursements.length === 0) {
      return sendResponse(res, null, 'disbursements est requis (tableau non vide)', false, undefined, 400);
    }
    if (disbursements.length > 100) {
      return sendResponse(res, null, 'Maximum 100 items par batch', false, undefined, 400);
    }

    const result = await senepay.createBatchPayout({
      external_id: external_id || generateOrderReference(),
      callback_url: callback_url || process.env.SENEPAY_WEBHOOK_URL,
      disbursements,
    });

    if (!result.success) {
      return sendResponse(res, null, result.error || 'Échec batch payout', false, undefined, 400);
    }

    sendResponse(res, result, 'Batch payout initié');
  } catch (err) {
    logger(`[SenePay] batch payout erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

/**
 * GET /api/v1/senepay/payout/:id
 * {id} = disbursement_id (DISB_*) ou external_id
 * Auth : JWT requis
 */
router.get('/payout/:id', requireSenePayConfig, protect, async (req, res) => {
  try {
    const result = await senepay.getPayoutStatus(req.params.id);
    if (!result.success) {
      return sendResponse(res, null, result.error || 'Payout introuvable', false, undefined, 404);
    }
    sendResponse(res, result, 'Statut payout');
  } catch (err) {
    logger(`[SenePay] payout status erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

/**
 * POST /api/v1/senepay/payout/estimate
 * Body : { amount, operator, country? }
 * Auth : JWT requis
 */
router.post('/payout/estimate', requireSenePayConfig, protect, async (req, res) => {
  try {
    const { amount, operator, country = DEFAULT_COUNTRY } = req.body;
    if (!amount || !operator) {
      return sendResponse(res, null, 'amount et operator sont requis', false, undefined, 400);
    }
    const result = await senepay.estimatePayout({ amount, country, operator });
    if (!result.success) {
      return sendResponse(res, null, result.error || 'Échec estimation', false, undefined, 400);
    }
    sendResponse(res, result, 'Estimation des frais');
  } catch (err) {
    logger(`[SenePay] estimate erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/senepay/wallet/balance
 * Auth : JWT + admin
 */
router.get('/wallet/balance', requireSenePayConfig, protect, authorize('admin'), async (req, res) => {
  try {
    const result = await senepay.getWalletBalance();
    if (!result.success) {
      return sendResponse(res, null, result.error || 'Erreur wallet', false, undefined, 500);
    }
    sendResponse(res, result, 'Solde wallet');
  } catch (err) {
    logger(`[SenePay] wallet balance erreur : ${err.message}`, 'error');
    sendResponse(res, null, 'Erreur serveur', false, undefined, 500);
  }
});

// ─────────────────────────────────────────────────────────────────
// WEBHOOKS — vérification HMAC-SHA256, pas de protect JWT
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/senepay/webhooks/payin
 *
 * Reçoit : checkout.session.completed | checkout.session.failed
 * Signature : X-SenePay-Signature (HMAC-SHA256 sur corps brut)
 *
 * Résolution utilisateur : payload.metadata.userId
 * → SenePay retourne le metadata tel quel dans le webhook
 * → on retrouve userId sans aucune DB supplémentaire
 *
 * ⚠️ req.rawBody obligatoire — HMAC calculé sur le corps brut
 *    (capturé par le verify() d'express.json dans http.js)
 */
router.post('/webhooks/payin', async (req, res) => {
  try {
    const signature = req.headers['x-senepay-signature'];
    const event     = req.headers['x-senepay-event'];

    if (!signature) {
      logger('[SenePay] Webhook payin : signature manquante', 'warning');
      return res.status(401).json({ success: false, message: 'Signature manquante' });
    }

    if (!senepay.verifyWebhookSignature(req.rawBody, signature)) {
      logger('[SenePay] Webhook payin : signature invalide', 'warning');
      return res.status(401).json({ success: false, message: 'Signature invalide' });
    }

    // Répondre 200 immédiatement — SenePay réessaie 3x si non-2xx
    res.status(200).json({ received: true });

    const payload = req.body;
    logger(`[SenePay] Webhook payin : ${event} | ref=${payload.orderReference} | status=${payload.status}`, 'info');

    // userId récupéré directement depuis metadata — zéro DB
    const userId    = payload.metadata?.userId    || null;
    const userEmail = payload.metadata?.userEmail || null;
    const userName  = payload.metadata?.userName  || 'Client';

    // ── Paiement confirmé ─────────────────────────────────────────
    if (payload.event === 'checkout.session.completed') {
      const { orderReference, transactionId, amount, currency, fees, netAmount } = payload;
      const operator = payload.payment?.operator || '-';
      const paidAt   = payload.payment?.paidAt   || payload.timestamp || new Date().toISOString();

      // 0. Activer le plan Premium sur l'utilisateur + historique
      if (userId) {
        try {
          const plan             = payload.metadata?.plan             || 'premium';
          const billingMode      = payload.metadata?.billingMode      || 'monthly';
          const subscriptionDays = parseInt(payload.metadata?.subscriptionDays || '30', 10);
          const premiumUntil     = new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000);

          const User = getModel('Trivida', 'User');
          await User.findByIdAndUpdate(userId, {
            $set:  { isPremium: true, premiumPlan: plan, premiumUntil },
            $push: {
              paymentHistory: {
                $each: [{
                  plan, amount, currency: currency || DEFAULT_CURRENCY,
                  billingMode, status: 'completed',
                  orderReference, transactionId,
                  createdAt: new Date(paidAt),
                }],
                $slice: -50,
              },
            },
          });
          logger(`[SenePay] Plan "${plan}" activé pour userId=${userId} jusqu'au ${premiumUntil.toISOString()}`, 'info');
        } catch (activationErr) {
          logger(`[SenePay] Erreur activation plan pour userId=${userId}: ${activationErr.message}`, 'error');
        }
      }

      // 1. Envoyer le reçu par email
      if (userEmail) {
        emailService.sendPaymentReceipt({
          email: userEmail,
          name:  userName,
          amount,
          currency:       currency || DEFAULT_CURRENCY,
          orderReference,
          transactionId,
          operator,
          fees:      fees      ?? 0,
          netAmount: netAmount ?? amount,
          paidAt,
          tenantId:  null,
        }).catch(err => logger(`[SenePay] Erreur envoi reçu : ${err.message}`, 'error'));
      } else {
        logger(`[SenePay] metadata.userEmail absent pour ref=${orderReference} — reçu non envoyé`, 'warning');
      }

      // 2. Notification Socket.io temps réel
      if (userId) {
        notificationService.sendToUser(userId, 'payment:confirmed', {
          orderReference,
          transactionId,
          amount,
          currency: currency || DEFAULT_CURRENCY,
          operator,
          paidAt,
          message: `Votre paiement de ${amount} ${currency || DEFAULT_CURRENCY} a été confirmé.`,
        });
      }

      logger(`[SenePay] Paiement confirmé : ref=${orderReference} | tx=${transactionId} | ${amount} ${currency || DEFAULT_CURRENCY}`, 'info');
    }

    // ── Paiement échoué ───────────────────────────────────────────
    if (payload.event === 'checkout.session.failed') {
      const { orderReference, sessionToken, amount, currency } = payload;

      logger(`[SenePay] Paiement échoué : ref=${orderReference}`, 'warning');

      if (userId) {
        notificationService.sendToUser(userId, 'payment:failed', {
          orderReference,
          amount,
          currency: currency || DEFAULT_CURRENCY,
          message: `Votre paiement de ${amount} ${currency || DEFAULT_CURRENCY} a échoué. Veuillez réessayer.`,
        });
      }

      setImmediate(() => {
        sendAlert({
          event:    'SENEPAY_PAYMENT_FAILED',
          status:   'WARNING',
          http:     'POST /api/v1/senepay/webhooks/payin',
          details:  { orderReference, sessionToken, amount, currency: currency || DEFAULT_CURRENCY },
          dedupKey: `senepay:failed:${sessionToken}`,
        }).catch(() => {});
      });
    }

  } catch (err) {
    logger(`[SenePay] Webhook payin erreur : ${err.message}`, 'error');
  }
});

/**
 * POST /api/v1/senepay/webhooks/payout
 *
 * Reçoit : disbursement.completed | disbursement.failed
 * Signature : X-SenePay-Signature (HMAC-SHA256 sur corps brut)
 *
 * ⚠️ Ne pas traiter pending_verification comme un échec.
 *    Attendre disbursement.failed CONFIRMÉ.
 */
router.post('/webhooks/payout', async (req, res) => {
  try {
    const signature = req.headers['x-senepay-signature'];
    const event     = req.headers['x-senepay-event'];

    if (!signature) {
      logger('[SenePay] Webhook payout : signature manquante', 'warning');
      return res.status(401).json({ success: false, message: 'Signature manquante' });
    }

    if (!senepay.verifyWebhookSignature(req.rawBody, signature)) {
      logger('[SenePay] Webhook payout : signature invalide', 'warning');
      return res.status(401).json({ success: false, message: 'Signature invalide' });
    }

    res.status(200).json({ received: true });

    const payload = req.body;
    logger(`[SenePay] Webhook payout : ${event} | id=${payload.disbursement_id} | status=${payload.status}`, 'info');

    // ── Décaissement réussi ───────────────────────────────────────
    if (payload.event === 'disbursement.completed') {
      const { disbursement_id, amount, net_amount, recipient, metadata } = payload;

      logger(`[SenePay] Payout complété : id=${disbursement_id} | ${amount} ${DEFAULT_CURRENCY} → ${recipient?.phone}`, 'info');

      // userId dans metadata si injecté à la création du payout
      const userId    = metadata?.userId    || null;
      const userEmail = metadata?.userEmail || null;
      const userName  = metadata?.userName  || 'Client';

      if (userEmail) {
        emailService.sendGenericEmail({
          email:   userEmail,
          subject: `Virement reçu — ${net_amount ?? amount} ${DEFAULT_CURRENCY}`,
          html:    emailService.generateNotificationTemplate(
            `Bonjour ${userName},<br><br>Vous avez reçu un virement de <strong>${net_amount ?? amount} ${DEFAULT_CURRENCY}</strong> sur votre compte <strong>${(recipient?.operator || '').toUpperCase()}</strong>.<br>Référence : <code>${disbursement_id}</code>`,
            null
          ),
        }).catch(err => logger(`[SenePay] Erreur email payout : ${err.message}`, 'error'));
      }

      if (userId) {
        notificationService.sendToUser(userId, 'payout:completed', {
          disbursement_id,
          amount,
          net_amount,
          currency: DEFAULT_CURRENCY,
          operator: recipient?.operator,
          message: `Votre virement de ${net_amount ?? amount} ${DEFAULT_CURRENCY} a été envoyé avec succès.`,
        });
      }
    }

    // ── Décaissement échoué ───────────────────────────────────────
    if (payload.event === 'disbursement.failed') {
      const { disbursement_id, external_id, amount, error_code, error_message, metadata } = payload;

      logger(`[SenePay] Payout échoué : id=${disbursement_id} | code=${error_code}`, 'warning');

      const userId = metadata?.userId || null;
      if (userId) {
        notificationService.sendToUser(userId, 'payout:failed', {
          disbursement_id,
          amount,
          currency:  DEFAULT_CURRENCY,
          error_code,
          message: `Votre virement de ${amount} ${DEFAULT_CURRENCY} a échoué. Le solde a été remboursé automatiquement.`,
        });
      }

      setImmediate(() => {
        sendAlert({
          event:    'SENEPAY_PAYOUT_FAILED',
          status:   'WARNING',
          http:     'POST /api/v1/senepay/webhooks/payout',
          details:  { disbursement_id, external_id, amount, error_code, error_message },
          dedupKey: `senepay:payout:failed:${disbursement_id}`,
        }).catch(() => {});
      });
    }

  } catch (err) {
    logger(`[SenePay] Webhook payout erreur : ${err.message}`, 'error');
  }
});

module.exports = router;
