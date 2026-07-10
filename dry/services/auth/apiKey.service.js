/**
 * Service — Gestion des clés API
 * Génération, hachage, validation et CRUD des clés API par utilisateur.
 * @module dry/services/auth/apiKey.service
 */
const crypto = require('crypto');
const getModel = require('../../core/factories/modelFactory');
const ApiKeySchema = require('../../models/apiKey/ApiKey.schema');

/**
 * Récupère le modèle ApiKey pour le tenant courant.
 * Suit le même repli que dry/middlewares/protection/auth.middleware.js :
 * req.getModel si injecté (routes montées par app), sinon req.appName, sinon 'Trivida'.
 */
const getApiKeyModel = (req) => {
  if (typeof req?.getModel === 'function') return req.getModel('ApiKey', ApiKeySchema);
  return getModel(req?.appName || 'Trivida', 'ApiKey', ApiKeySchema);
};

const generateApiKey = () => crypto.randomBytes(32).toString('hex');

const hashApiKey = (rawKey) => crypto.createHash('sha256').update(rawKey).digest('hex');

/**
 * Crée une nouvelle clé API pour un utilisateur.
 * @returns {Promise<{record: object, rawKey: string}>} rawKey n'est jamais stocké — à retourner UNE SEULE FOIS à l'utilisateur.
 */
const createApiKey = async (req, userId, { name, permissions, expiresAt, rateLimitMax }) => {
  const ApiKey = getApiKeyModel(req);
  const rawKey = generateApiKey();

  const record = await ApiKey.create({
    userId,
    name,
    keyHash: hashApiKey(rawKey),
    keyPrefix: rawKey.slice(0, 8),
    permissions: permissions?.length ? permissions : ['read'],
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    rateLimitMax: rateLimitMax || 1000,
  });

  return { record, rawKey };
};

const listApiKeys = async (req, userId) => {
  const ApiKey = getApiKeyModel(req);
  return ApiKey.find({ userId }).sort({ createdAt: -1 });
};

const revokeApiKey = async (req, userId, keyId) => {
  const ApiKey = getApiKeyModel(req);
  return ApiKey.findOneAndUpdate(
    { _id: keyId, userId },
    { $set: { status: 'revoked' } },
    { new: true }
  );
};

/**
 * Rotation : révoque l'ancienne clé et en émet une nouvelle avec les mêmes attributs.
 */
const rotateApiKey = async (req, userId, keyId) => {
  const ApiKey = getApiKeyModel(req);
  const existing = await ApiKey.findOne({ _id: keyId, userId });
  if (!existing) return null;

  existing.status = 'revoked';
  await existing.save();

  return createApiKey(req, userId, {
    name: existing.name,
    permissions: existing.permissions,
    expiresAt: existing.expiresAt,
    rateLimitMax: existing.rateLimitMax,
  });
};

/**
 * Valide une clé API fournie (header x-api-key) pour un utilisateur donné.
 * Met à jour lastUsedAt en cas de succès (non-bloquant).
 */
const validateApiKey = async (req, userId, providedKey) => {
  if (!providedKey) return false;

  const ApiKey = getApiKeyModel(req);
  const keyHash = hashApiKey(providedKey);

  const record = await ApiKey.findOne({ userId, keyHash, status: 'active' }).select('+keyHash');
  if (!record) return false;

  if (record.expiresAt && record.expiresAt < new Date()) return false;

  ApiKey.updateOne({ _id: record._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

  return true;
};

module.exports = {
  generateApiKey,
  hashApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  validateApiKey,
};
