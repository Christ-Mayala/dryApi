const crypto = require('crypto');

const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

const validateApiKey = (userId, providedKey) => {
  // Logique pour valider la clé API par rapport à l'utilisateur
};

module.exports = {
  generateApiKey,
  validateApiKey,
};