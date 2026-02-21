const asyncHandler = require('express-async-handler');
const PaymentFactory = require('../../../../../dry/services/payment/payment.factory');
const notificationService = require('../../../../../dry/services/notification/notification.service');
const sendResponse = require('../../../../../dry/utils/http/response');

/**
 * Initialiser un paiement
 * POST /api/v1/skillforge/payment/init
 */
exports.initPayment = asyncHandler(async (req, res) => {
  const { provider, amount, currency, description, customerPhone, customerEmail, customerName } = req.body;
  
  // Configuration dynamique
  const config = {
    apiKey: process.env.CINETPAY_API_KEY,
    siteId: process.env.CINETPAY_SITE_ID,
    secretKey: process.env.STRIPE_SECRET_KEY,
    // Configuration Moneroo
    monerooApiKey: process.env.MONEROO_API_KEY,
    monerooReturnUrl: process.env.MONEROO_RETURN_URL,
    // Configuration MTN & Airtel
    subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY,
    apiUser: process.env.MTN_API_USER,
    mtnApiKey: process.env.MTN_API_KEY,
    targetEnvironment: process.env.MTN_TARGET_ENV || 'sandbox',
    clientId: process.env.AIRTEL_CLIENT_ID,
    clientSecret: process.env.AIRTEL_CLIENT_SECRET
  };

  // Mapping spécifique des clés pour chaque provider
  if (provider) {
    const p = provider.toLowerCase();
    if (p === 'moneroo' || p === 'monero') {
        config.apiKey = config.monerooApiKey;
        config.returnUrl = config.monerooReturnUrl;
    }
    if (p === 'mtn') {
        config.apiKey = config.mtnApiKey;
    }
    // Note: CinetPay, Stripe et Airtel utilisent directement les clés mappées ci-dessus
    // via la PaymentFactory qui reçoit tout l'objet config.
  }

  const paymentProvider = PaymentFactory.getProvider(provider, config);
  const transactionId = 'TX-' + Date.now();

  const result = await paymentProvider.initPayment({
    amount,
    currency: currency || 'XAF',
    transactionId,
    description,
    customerPhone,
    customerEmail,
    customerName
  });

  if (!result.success) {
    res.status(400);
    throw new Error(result.error || 'Erreur paiement');
  }

  sendResponse(res, result, 'Paiement initié avec succès');
});

/**
 * Vérifier un paiement
 * GET /api/v1/skillforge/payment/verify/:id
 */
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { provider } = req.query;
  const { id } = req.params;
  
  const config = {
    apiKey: process.env.CINETPAY_API_KEY,
    siteId: process.env.CINETPAY_SITE_ID,
    secretKey: process.env.STRIPE_SECRET_KEY,
    monerooApiKey: process.env.MONEROO_API_KEY
  };

  if (provider && (provider.toLowerCase() === 'moneroo' || provider.toLowerCase() === 'monero')) {
      config.apiKey = config.monerooApiKey;
  }

  const paymentProvider = PaymentFactory.getProvider(provider || 'cinetpay', config);
  const result = await paymentProvider.verifyPayment(id);

  // Exemple de notification temps réel en cas de succès (si utilisateur connecté)
  if (result.success && req.user) {
      // notificationService.sendToUser(req.user._id, 'payment_success', { transactionId: id, amount: result.amount });
  }

  sendResponse(res, result, 'Statut paiement récupéré');
});