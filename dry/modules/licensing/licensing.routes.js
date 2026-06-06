/**
 * Routes Licensing — Gestion des licences et clés API
 * @module dry/modules/licensing/licensing.routes
 */

const express = require('express');
const { protect, authorize } = require('../../middlewares/protection/auth.middleware');
const licensing = require('./index');
const logger = require('../../utils/logging/logger');

const router = express.Router();

/**
 * POST /api/v1/licensing/validate
 * Valide une clé de licence
 */
router.post('/validate', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey) {
      return res.status(400).json({ success: false, message: 'Clé de licence requise' });
    }

    const isValidFormat = licensing.validateLicenseFormat(licenseKey);
    if (!isValidFormat) {
      return res.status(400).json({ success: false, message: 'Format de clé invalide. Format attendu: DRY-XXXX-XXXX-XXXX-XXXX-XXXX' });
    }

    // TODO: Vérifier contre la base de données
    // const hash = await getLicenseHash(licenseKey);
    // const valid = await licensing.verifyLicenseKey(licenseKey, hash);

    res.status(200).json({
      success: true,
      data: {
        valid: isValidFormat,
        format: 'DRY-XXXX-XXXX-XXXX-XXXX-XXXX',
        hint: 'À connecter avec votre base de données pour validation complète',
      },
    });
  } catch (error) {
    logger(`[Licensing] Erreur validation: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/licensing/generate
 * Génère une nouvelle licence (admin requis)
 */
router.post('/generate', protect, authorize('admin'), async (req, res) => {
  try {
    const { tier, customerEmail, customerName, durationDays } = req.body;

    if (!tier || !Object.keys(licensing.TIERS).includes(tier)) {
      return res.status(400).json({
        success: false,
        message: `Tier invalide. Tiers: ${Object.keys(licensing.TIERS).join(', ')}`,
      });
    }

    const license = await licensing.createLicense({
      tier,
      customerId: req.user._id.toString(),
      customerEmail: customerEmail || req.user.email,
      customerName: customerName || req.user.name,
      durationDays: durationDays || 365,
    });

    res.status(201).json({
      success: true,
      data: {
        key: license.key,
        tier: license.tier,
        expiresAt: license.expiresAt,
        features: license.metadata.features,
      },
    });
  } catch (error) {
    logger(`[Licensing] Erreur génération: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/v1/licensing/activate
 * Active une licence avec une clé
 */
router.post('/activate', protect, async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey) {
      return res.status(400).json({ success: false, message: 'Clé de licence requise' });
    }

    const isValidFormat = licensing.validateLicenseFormat(licenseKey);
    if (!isValidFormat) {
      return res.status(400).json({ success: false, message: 'Format de clé invalide' });
    }

    // TODO: Sauvegarder l'activation en base de données
    // await saveActivation(req.user._id, licenseKey);

    logger(`[Licensing] Licence activée: ${licenseKey.slice(0, 14)}... (${req.user.email})`, 'info');

    res.status(200).json({
      success: true,
      data: {
        activated: true,
        keyPrefix: licenseKey.slice(0, 14),
        message: 'Licence activée avec succès',
      },
    });
  } catch (error) {
    logger(`[Licensing] Erreur activation: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/licensing/features
 * Liste les fonctionnalités disponibles par tier
 */
router.get('/features', async (req, res) => {
  const features = Object.entries(licensing.TIERS).map(([id, config]) => ({
    id,
    name: config.name,
    features: config.features,
    maxApps: config.maxApps === -1 ? 'Illimité' : config.maxApps,
    maxRequestsPerHour: config.maxRequestsPerHour === -1 ? 'Illimité' : config.maxRequestsPerHour,
    supportLevel: config.supportLevel,
  }));

  res.status(200).json({ success: true, data: features });
});

/**
 * GET /api/v1/licensing/check
 * Vérifie le statut de la licence de l'utilisateur connecté
 */
router.get('/check', protect, async (req, res) => {
  const user = req.user;
  const tier = user.plan || 'community';

  const validity = licensing.checkLicenseValidity({
    status: 'active',
    expiresAt: user.premiumUntil || null,
  });

  res.status(200).json({
    success: true,
    data: {
      tier,
      planName: licensing.TIERS[tier]?.name || 'Community',
      valid: validity.valid,
      features: licensing.TIERS[tier]?.features || [],
      supportLevel: licensing.TIERS[tier]?.supportLevel || 'community',
      expiresAt: user.premiumUntil || null,
    },
  });
});

module.exports = router;
