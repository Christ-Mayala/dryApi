/**
 * Module Licensing — Génération et validation des licences
 * Gère les clés de licence, l'expiration et les feature flags par tier
 * @module dry/modules/licensing
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../../../config/database');
const logger = require('../../utils/logging/logger');

/**
 * Tiers de licence disponibles
 */
const TIERS = {
  community: {
    name: 'Community',
    features: ['api_basic', 'docs_swagger', 'rate_limit_100'],
    maxApps: 1,
    maxRequestsPerHour: 100,
    supportLevel: 'community',
  },
  pro: {
    name: 'Pro',
    features: ['api_full', 'docs_swagger', 'rate_limit_1000', 'monitoring', 'export', 'api_keys_unlimited', 'support_priority'],
    maxApps: 10,
    maxRequestsPerHour: 1000,
    supportLevel: 'priority',
  },
  enterprise: {
    name: 'Enterprise',
    features: ['api_full', 'docs_swagger', 'rate_limit_unlimited', 'monitoring', 'export', 'api_keys_unlimited', 'sla_99_9', 'support_dedicated_24_7', 'audit_security', 'custom_deployment', 'team_training'],
    maxApps: -1, // Illimité
    maxRequestsPerHour: -1, // Illimité
    supportLevel: 'dedicated',
  },
};

/**
 * Longueur des clés de licence
 */
const LICENSE_KEY_LENGTH = 48;

/**
 * Génère une clé de licence sécurisée
 * Format: DRY-XXXX-XXXX-XXXX-XXXX-XXXX
 * @param {string} tier - Tier de licence
 * @param {string} customerId - ID client
 * @returns {string} Clé de licence formatée
 */
const generateLicenseKey = (tier, customerId) => {
  const prefix = 'DRY';
  const randomPart = crypto.randomBytes(24).toString('hex').toUpperCase();
  const hash = crypto
    .createHash('sha256')
    .update(`${tier}:${customerId}:${randomPart}:${config.ENCRYPTION_KEY || 'dry-lic'}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  const raw = `${randomPart}${hash}`;
  // Formater en groupes de 4
  const groups = raw.match(/.{1,4}/g) || [];
  return `${prefix}-${groups.slice(0, 6).join('-')}`;
};

/**
 * Valide le format d'une clé de licence
 * @param {string} key - Clé à valider
 * @returns {boolean} true si le format est valide
 */
const validateLicenseFormat = (key) => {
  if (!key || typeof key !== 'string') return false;
  return /^DRY-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){5}$/.test(key.trim());
};

/**
 * Hash une clé de licence pour stockage sécurisé
 * @param {string} key - Clé à hasher
 * @returns {Promise<string>} Hash bcrypt
 */
const hashLicenseKey = async (key) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(key, salt);
};

/**
 * Vérifie une clé de licence contre son hash
 * @param {string} key - Clé en clair
 * @param {string} hash - Hash stocké
 * @returns {Promise<boolean>} true si correspond
 */
const verifyLicenseKey = async (key, hash) => {
  return bcrypt.compare(key, hash);
};

/**
 * Crée une licence complète
 * @param {object} params - Paramètres de la licence
 * @param {string} params.tier - Tier (community, pro, enterprise)
 * @param {string} params.customerId - ID client
 * @param {string} params.customerEmail - Email client
 * @param {string} params.customerName - Nom client
 * @param {number} params.durationDays - Durée en jours (0 = illimité)
 * @returns {Promise<object>} Licence créée
 */
const createLicense = async ({ tier, customerId, customerEmail, customerName, durationDays = 365 }) => {
  const tierConfig = TIERS[tier];
  if (!tierConfig) {
    throw new Error(`Tier invalide: ${tier}. Tiers: ${Object.keys(TIERS).join(', ')}`);
  }

  const licenseKey = generateLicenseKey(tier, customerId);
  const keyHash = await hashLicenseKey(licenseKey);

  const now = new Date();
  const expiresAt = durationDays > 0
    ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
    : null;

  const license = {
    key: licenseKey,
    keyPrefix: licenseKey.slice(0, 14),
    keyHash,
    tier,
    customerId,
    customerEmail,
    customerName,
    status: 'active',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    durationDays,
    maxActivations: tier === 'enterprise' ? -1 : tier === 'pro' ? 5 : 1,
    activatedAt: null,
    lastVerifiedAt: null,
    metadata: {
      features: tierConfig.features,
      maxApps: tierConfig.maxApps,
      maxRequestsPerHour: tierConfig.maxRequestsPerHour,
      supportLevel: tierConfig.supportLevel,
    },
  };

  logger(`[Licensing] Licence créée: ${license.keyPrefix}... (${tier}, ${customerEmail})`, 'info');

  return license;
};

/**
 * Vérifie si une licence est valide (statut + expiration)
 * @param {object} license - Licence stockée
 * @returns {object} { valid, reason }
 */
const checkLicenseValidity = (license) => {
  if (!license) {
    return { valid: false, reason: 'LICENSE_NOT_FOUND' };
  }

  if (license.status !== 'active') {
    return { valid: false, reason: `LICENSE_${license.status.toUpperCase()}` };
  }

  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    return { valid: false, reason: 'LICENSE_EXPIRED', expiresAt: license.expiresAt };
  }

  return { valid: true, reason: null };
};

/**
 * Vérifie si une feature est accessible pour un tier donné
 * @param {string} tier - Tier de licence
 * @param {string} feature - Feature à vérifier
 * @returns {boolean} true si accessible
 */
const hasFeature = (tier, feature) => {
  const tierConfig = TIERS[tier];
  if (!tierConfig) return false;
  return tierConfig.features.includes(feature);
};

/**
 * Vérifie les limites d'utilisation
 * @param {string} tier - Tier de licence
 * @param {string} limitType - Type de limite (maxApps, maxRequestsPerHour)
 * @param {number} currentValue - Valeur actuelle
 * @returns {object} { allowed, limit, current }
 */
const checkLimit = (tier, limitType, currentValue = 0) => {
  const tierConfig = TIERS[tier];
  if (!tierConfig) return { allowed: false, limit: 0, current: currentValue };

  const limit = tierConfig[limitType];
  if (limit === -1) return { allowed: true, limit: Infinity, current: currentValue };

  return {
    allowed: currentValue < limit,
    limit,
    current: currentValue,
  };
};

/**
 * Middleware de validation de licence pour les routes protégées
 * @param {string} requiredFeature - Feature requise (optionnelle)
 * @returns {Function} Middleware Express
 */
const requireLicense = (requiredFeature) => {
  return (req, res, next) => {
    // Récupérer la licence depuis l'utilisateur
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const tier = user.plan || user.tier || 'community';

    // Vérifier la feature si spécifiée
    if (requiredFeature && !hasFeature(tier, requiredFeature)) {
      return res.status(403).json({
        success: false,
        message: `Votre plan ${TIERS[tier]?.name || tier} n'inclut pas cette fonctionnalité.`,
        requiredFeature,
        currentPlan: tier,
        upgradeUrl: '/api/v1/billing/plans',
      });
    }

    next();
  };
};

module.exports = {
  generateLicenseKey,
  validateLicenseFormat,
  hashLicenseKey,
  verifyLicenseKey,
  createLicense,
  checkLicenseValidity,
  hasFeature,
  checkLimit,
  requireLicense,
  TIERS,
};
