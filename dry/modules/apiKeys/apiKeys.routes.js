/**
 * Routes API Keys — Gestion des clés API de l'utilisateur connecté
 * Monté automatiquement sur /api/v1/apikeys (voir dry/bootstrap/routes.js)
 * @module dry/modules/apiKeys/apiKeys.routes
 */
const express = require('express');
const { protect } = require('../../middlewares/protection/auth.middleware');
const { withAudit } = require('../../middlewares/audit');
const sendResponse = require('../../utils/http/response');
const { validateWithZod } = require('../../utils/validation/zod.util');
const { createApiKeySchema, updateApiKeySchema } = require('../../schemas/apiKey.schema');
const apiKeyService = require('../../services/auth/apiKey.service');
const getModel = require('../../core/factories/modelFactory');
const ApiKeyMongooseSchema = require('../../models/apiKey/ApiKey.schema');

const router = express.Router();

const toPublicShape = (record) => ({
  _id: record._id,
  name: record.name,
  keyPrefix: record.keyPrefix,
  permissions: record.permissions,
  status: record.status,
  rateLimitMax: record.rateLimitMax,
  lastUsedAt: record.lastUsedAt,
  expiresAt: record.expiresAt,
  createdAt: record.createdAt,
});

/**
 * POST /api/v1/apikeys
 * Crée une nouvelle clé API. La clé brute n'est retournée qu'une seule fois.
 */
router.post('/', protect, withAudit('API_KEY_CREATE'), async (req, res) => {
  const validation = validateWithZod(createApiKeySchema, req.body);
  if (!validation.success) {
    return sendResponse(res, validation.error, 'Données invalides', false, undefined, 400);
  }

  try {
    const { record, rawKey } = await apiKeyService.createApiKey(req, req.user._id, validation.data);
    sendResponse(
      res,
      { ...toPublicShape(record), key: rawKey },
      'Clé API créée — copiez-la maintenant, elle ne sera plus jamais affichée en entier.',
      true,
      undefined,
      201
    );
  } catch (error) {
    sendResponse(res, null, error.message || 'Erreur lors de la création de la clé API', false, undefined, 500);
  }
});

/**
 * GET /api/v1/apikeys
 * Liste les clés API de l'utilisateur connecté (jamais la clé en clair).
 */
router.get('/', protect, async (req, res) => {
  try {
    const keys = await apiKeyService.listApiKeys(req, req.user._id);
    sendResponse(res, keys.map(toPublicShape), 'Clés API récupérées');
  } catch (error) {
    sendResponse(res, null, 'Erreur lors de la récupération des clés API', false, undefined, 500);
  }
});

/**
 * DELETE /api/v1/apikeys/:id
 * Révoque une clé API (soft — status passe à "revoked").
 */
router.delete('/:id', protect, withAudit('API_KEY_REVOKE'), async (req, res) => {
  try {
    const revoked = await apiKeyService.revokeApiKey(req, req.user._id, req.params.id);
    if (!revoked) return sendResponse(res, null, 'Clé API introuvable', false, undefined, 404);
    sendResponse(res, toPublicShape(revoked), 'Clé API révoquée');
  } catch (error) {
    sendResponse(res, null, 'Erreur lors de la révocation de la clé API', false, undefined, 500);
  }
});

/**
 * PUT /api/v1/apikeys/:id/rotate
 * Révoque l'ancienne clé et en émet une nouvelle avec les mêmes permissions/attributs.
 */
router.put('/:id/rotate', protect, withAudit('API_KEY_ROTATE'), async (req, res) => {
  try {
    const rotated = await apiKeyService.rotateApiKey(req, req.user._id, req.params.id);
    if (!rotated) return sendResponse(res, null, 'Clé API introuvable', false, undefined, 404);
    sendResponse(
      res,
      { ...toPublicShape(rotated.record), key: rotated.rawKey },
      'Clé API régénérée — copiez-la maintenant, elle ne sera plus jamais affichée en entier.'
    );
  } catch (error) {
    sendResponse(res, null, 'Erreur lors de la rotation de la clé API', false, undefined, 500);
  }
});

/**
 * PATCH /api/v1/apikeys/:id
 * Met à jour le nom/permissions/statut/expiration d'une clé (sans la régénérer).
 */
router.patch('/:id', protect, withAudit('API_KEY_UPDATE'), async (req, res) => {
  const validation = validateWithZod(updateApiKeySchema, req.body);
  if (!validation.success) {
    return sendResponse(res, validation.error, 'Données invalides', false, undefined, 400);
  }

  try {
    const ApiKey = typeof req.getModel === 'function'
      ? req.getModel('ApiKey', ApiKeyMongooseSchema)
      : getModel(req.appName || 'Trivida', 'ApiKey', ApiKeyMongooseSchema);

    const updated = await ApiKey.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: validation.data },
      { new: true }
    );
    if (!updated) return sendResponse(res, null, 'Clé API introuvable', false, undefined, 404);
    sendResponse(res, toPublicShape(updated), 'Clé API mise à jour');
  } catch (error) {
    sendResponse(res, null, 'Erreur lors de la mise à jour de la clé API', false, undefined, 500);
  }
});

module.exports = router;
