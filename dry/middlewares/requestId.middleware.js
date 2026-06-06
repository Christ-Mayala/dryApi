/**
 * Middleware d'ID de Requête
 * Génère un UUID pour chaque requête et l'ajoute aux logs et headers de réponse
 * Permet le traçage de bout en bout des requêtes dans les logs
 * @module dry/middleware/requestId.middleware
 */

const crypto = require('crypto');

/**
 * Génère un identifiant unique pour une requête
 * @param {string} [prefix='req'] - Préfixe optionnel
 * @returns {string} Identifiant unique
 */
const generateRequestId = (prefix = 'req') => {
  const randomBytes = crypto.randomBytes(12).toString('hex');
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${randomBytes}`;
};

/**
 * Middleware Express qui ajoute un ID de requête
 * Lit d'abord le header X-Request-ID s'il est fourni (pour le tracing distribué)
 * Sinon génère un nouvel ID
 *
 * @param {object} options - Options de configuration
 * @param {string} [options.header='X-Request-ID'] - Nom du header
 * @param {string} [options.prefix='req'] - Préfixe de l'ID
 * @param {boolean} [options.setHeader=true] - Ajouter le header à la réponse
 * @returns {Function} Middleware Express
 */
const requestIdMiddleware = (options = {}) => {
  const {
    header = 'X-Request-ID',
    prefix = 'req',
    setHeader = true,
  } = options;

  return (req, res, next) => {
    // Utiliser l'ID existant s'il est fourni (tracing distribué)
    const existingId = req.headers[header.toLowerCase()] ||
                       req.headers['x-request-id'] ||
                       req.headers['x-correlation-id'];

    req.id = existingId || generateRequestId(prefix);
    req.requestId = req.id;

    // Ajouter aux headers de réponse
    if (setHeader) {
      res.setHeader(header, req.id);
    }

    // Ajouter à res.locals pour compatibilité avec les vues/templates
    res.locals.requestId = req.id;

    // Ajouter aux logs via la propriété de la requête
    res.on('finish', () => {
      req.logContext = {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        contentLength: res.get('content-length'),
        userAgent: req.get('user-agent'),
        ip: req.ip,
      };
    });

    next();
  };
};

module.exports = { requestIdMiddleware, generateRequestId };
