const { validateApiKey } = require('../../services/auth/apiKey.service');
const sendResponse = require('../../utils/http/response');

const validateApiKeyMiddleware = async (req, res, next) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) return sendResponse(res, null, 'Clé API manquante', false);

  const userId = req.user?._id; // Supposons que req.user est défini par un middleware d'authentification précédent
  if (!userId) return sendResponse(res, null, 'Utilisateur non authentifié', false);

  const isValid = await validateApiKey(userId, apiKey);
  if (!isValid) return sendResponse(res, null, 'Clé API invalide', false);

  next();
};

module.exports = validateApiKeyMiddleware;