/**
 * Middleware — Authentification par clé API (header x-api-key)
 * Alternative au JWT pour un accès programmatique. Nécessite req.user déjà
 * résolu (ex: après un `protect`), ou un userId transmis autrement selon la route.
 * @module dry/middlewares/apiKey/apiKey.middleware
 */
const { validateApiKey } = require('../../services/auth/apiKey.service');
const sendResponse = require('../../utils/http/response');

const validateApiKeyMiddleware = async (req, res, next) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) return sendResponse(res, null, 'Clé API manquante', false, undefined, 401);

  const userId = req.user?._id;
  if (!userId) return sendResponse(res, null, 'Utilisateur non authentifié', false, undefined, 401);

  const isValid = await validateApiKey(req, userId, apiKey);
  if (!isValid) return sendResponse(res, null, 'Clé API invalide ou expirée', false, undefined, 401);

  next();
};

module.exports = validateApiKeyMiddleware;
