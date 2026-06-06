/**
 * Routes Billing — Gestion des abonnements Stripe
 * @module dry/modules/billing/billing.routes
 */

const express = require('express');
const { protect, authorize } = require('../../middlewares/protection/auth.middleware');
const billing = require('./index');
const config = require('../../../config/database');
const logger = require('../../utils/logging/logger');

const router = express.Router();

/**
 * POST /api/v1/billing/checkout-session
 * Crée une session de checkout Stripe pour un abonnement
 */
router.post('/checkout-session', protect, async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user._id.toString();
    const baseUrl = config.SERVER_URL || `http://localhost:${config.PORT}`;

    const session = await billing.createCheckoutSession(
      planId,
      userId,
      `${baseUrl}/billing/success`,
      `${baseUrl}/billing/cancel`
    );

    res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger(`[Billing] Erreur checkout: ${error.message}`, 'error');
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/billing/plans
 * Liste les plans disponibles
 */
router.get('/plans', async (req, res) => {
  const plans = Object.entries(billing.PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    interval: plan.interval,
    features: plan.features,
    limits: plan.limits,
  }));

  res.status(200).json({ success: true, data: plans });
});

/**
 * GET /api/v1/billing/invoices
 * Récupère les factures de l'utilisateur connecté
 */
router.get('/invoices', protect, async (req, res) => {
  try {
    const stripeCustomerId = req.user.stripeCustomerId;
    if (!stripeCustomerId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const invoices = await billing.getInvoices(stripeCustomerId);
    res.status(200).json({ success: true, data: invoices });
  } catch (error) {
    logger(`[Billing] Erreur factures: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: 'Erreur récupération factures' });
  }
});

/**
 * GET /api/v1/billing/subscription
 * Récupère l'abonnement actuel de l'utilisateur
 */
router.get('/subscription', protect, async (req, res) => {
  const user = req.user;
  const plan = billing.PLANS[user.plan || 'community'];

  res.status(200).json({
    success: true,
    data: {
      plan: user.plan || 'community',
      planName: plan?.name || 'Community',
      isPremium: user.isPremium || false,
      premiumUntil: user.premiumUntil || null,
      features: plan?.features || [],
    },
  });
});

/**
 * POST /api/v1/webhooks/stripe
 * Webhook Stripe pour les événements de paiement
 */
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Signature Stripe manquante' });
    }

    const event = await billing.handleWebhook(req.body, signature);
    res.status(200).json(event);
  } catch (error) {
    logger(`[Billing] Erreur webhook: ${error.message}`, 'error');
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
