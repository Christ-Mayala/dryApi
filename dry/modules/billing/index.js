/**
 * Module Billing — Gestion des abonnements et paiements Stripe
 * @module dry/modules/billing
 */

const config = require('../../../config/database');
const logger = require('../../utils/logging/logger');

let stripe = null;

try {
  if (config.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(config.STRIPE_SECRET_KEY);
  }
} catch (error) {
  logger(`[Billing] Stripe non disponible: ${error.message}`, 'warning');
}

/**
 * Plans disponibles
 */
const PLANS = {
  community: {
    id: 'community',
    name: 'Community',
    price: 0,
    currency: 'eur',
    interval: 'month',
    features: [
      'API de base',
      '100 req/heure',
      'Documentation Swagger',
      'Support communautaire',
    ],
    limits: {
      requestsPerHour: 100,
      apps: 1,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99,
    currency: 'eur',
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRICE_PRO || '',
    features: [
      'API complète',
      '1000 req/heure',
      'Support prioritaire',
      'Monitoring Prometheus',
      'Multi-applications',
      'Clés API illimitées',
      'Export de données',
    ],
    limits: {
      requestsPerHour: 1000,
      apps: 10,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    currency: 'eur',
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    features: [
      'Tout Pro +',
      'Reqêtes illimitées',
      'SLA 99.9%',
      'Support dédié 24/7',
      'Déploiement personnalisé',
      'Audit de sécurité',
      'Formation équipe',
    ],
    limits: {
      requestsPerHour: -1,
      apps: -1,
    },
  },
};

/**
 * Crée une session de checkout Stripe
 * @param {string} planId - ID du plan
 * @param {string} userId - ID utilisateur
 * @param {string} successUrl - URL de retour succès
 * @param {string} cancelUrl - URL de retour annulation
 * @returns {Promise<object>} Session checkout
 */
const createCheckoutSession = async (planId, userId, successUrl, cancelUrl) => {
  const plan = PLANS[planId];
  if (!plan) {
    throw new Error(`Plan '${planId}' invalide. Plans: ${Object.keys(PLANS).join(', ')}`);
  }

  if (plan.price === 0) {
    // Plan gratuit — pas besoin de checkout Stripe
    return {
      url: successUrl,
      planId: plan.id,
      free: true,
    };
  }

  if (!stripe) {
    throw new Error('Stripe n\'est pas configuré. Définissez STRIPE_SECRET_KEY.');
  }

  if (!plan.stripePriceId) {
    throw new Error(`Aucun stripePriceId configuré pour le plan ${planId}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    client_reference_id: userId,
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      planId,
    },
  });

  return {
    url: session.url,
    sessionId: session.id,
    planId: plan.id,
  };
};

/**
 * Récupère les factures d'un utilisateur
 * @param {string} stripeCustomerId - ID client Stripe
 * @returns {Promise<Array>} Liste des factures
 */
const getInvoices = async (stripeCustomerId) => {
  if (!stripe) return [];

  try {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 12,
    });

    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.total / 100,
      currency: inv.currency,
      status: inv.status,
      pdfUrl: inv.invoice_pdf,
      date: new Date(inv.created * 1000).toISOString(),
      paidAt: inv.status === 'paid' ? new Date(inv.status_transitioned * 1000).toISOString() : null,
    }));
  } catch (error) {
    logger(`[Billing] Erreur récupération factures: ${error.message}`, 'error');
    return [];
  }
};

/**
 * Traite un webhook Stripe
 * @param {string} payload - Corps brut de la requête
 * @param {string} signature - Signature Stripe
 * @returns {Promise<object>} Événement traité
 */
const handleWebhook = async (payload, signature) => {
  if (!stripe) {
    throw new Error('Stripe non configuré');
  }

  const webhookSecret = config.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET non configuré');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    throw new Error(`Signature webhook invalide: ${error.message}`);
  }

  // Gérer les événements
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      logger(`[Billing] Paiement réussi: session=${session.id}, user=${session.metadata.userId}, plan=${session.metadata.planId}`, 'info');
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      logger(`[Billing] Facture payée: ${invoice.number}`, 'info');
      break;
    }
    case 'invoice.payment_failed': {
      const failedInvoice = event.data.object;
      logger(`[Billing] Échec paiement facture: ${failedInvoice.number}`, 'warning');
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      logger(`[Billing] Abonnement mis à jour: ${subscription.id}`, 'info');
      break;
    }
    case 'customer.subscription.deleted': {
      const cancelled = event.data.object;
      logger(`[Billing] Abonnement résilié: ${cancelled.id}`, 'info');
      break;
    }
    default:
      logger(`[Billing] Événement non géré: ${event.type}`, 'debug');
  }

  return { received: true, type: event.type };
};

/**
 * Vérifie les limites d'un plan pour un utilisateur
 * @param {object} user - Utilisateur
 * @param {string} feature - Feature à vérifier
 * @returns {object} { allowed, limit, current }
 */
const checkPlanLimit = (user, feature = 'requestsPerHour') => {
  const planId = user.plan || 'community';
  const plan = PLANS[planId];
  if (!plan) return { allowed: false, limit: 0, current: 0 };

  const limit = plan.limits[feature];
  if (limit === -1) return { allowed: true, limit: Infinity, current: 0 };

  // Exemple: compter les requêtes récentes (à implémenter avec Redis)
  return { allowed: true, limit, current: 0 };
};

module.exports = {
  createCheckoutSession,
  getInvoices,
  handleWebhook,
  checkPlanLimit,
  PLANS,
};
