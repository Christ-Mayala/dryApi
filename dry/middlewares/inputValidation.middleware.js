/**
 * Middleware de Validation des Entrées
 * Valide Content-Type, Content-Length, nettoie les entrées (XSS, injection NoSQL/SQL)
 * @module dry/middlewares/inputValidation.middleware
 */

const config = require('../../config/database');

/**
 * Patterns d'attaques à détecter
 */
const ATTACK_PATTERNS = {
  nosqlInjection: [
    /\$where/,
    /\$regex/,
    /\$ne/,
    /\$gt/,
    /\$lt/,
    /\$exists/,
    /\$nin/,
    /\$or/,
    /\$and/,
  ],
  sqlInjection: [
    /(\bSELECT\b.*\bFROM\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
    /(\bDELETE\b.*\bFROM\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /('|\")\s*(OR|AND)\s*('|\")\s*=/i,
    /--\s*$/m,
    /\/\*.*\*\//,
  ],
  xss: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript\s*:/gi,
    /on\w+\s*=\s*['"]?[^'"]*['"]?/gi,
    /<\s*iframe\b/gi,
    /<\s*object\b/gi,
    /<\s*embed\b/gi,
    /expression\s*\(/gi,
    /url\s*\(\s*['"]?\s*javascript/gi,
  ],
};

/**
 * Nettoie une chaîne de caractères des attaques XSS
 * @param {string} str - Chaîne à nettoyer
 * @returns {string} Chaîne nettoyée
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  return str
    // Remplacer les balises script
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remplacer javascript: dans les attributs
    .replace(/javascript\s*:/gi, 'blocked:')
    // Remplacer les gestionnaires d'événements inline
    .replace(/\bon\w+\s*=/gi, 'blocked=')
    // Remplacer les iframes
    .replace(/<\s*iframe\b/gi, '&lt;iframe')
    // Remplacer les expressions CSS
    .replace(/expression\s*\(/gi, 'blocked(')
    // Encoder les chevrons
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Nettoie récursivement un objet des attaques XSS
 * @param {*} value - Valeur à nettoyer
 * @param {number} depth - Profondeur de récursion
 * @returns {*} Valeur nettoyée
 */
const sanitizeObject = (value, depth = 0) => {
  if (depth > 10) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeObject(item, depth + 1));
  if (value && typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeObject(val, depth + 1);
    }
    return sanitized;
  }
  return value;
};

/**
 * Vérifie si une valeur contient des patterns d'attaque
 * @param {*} value - Valeur à vérifier
 * @param {number} depth - Profondeur de récursion
 * @returns {string|null} Message d'erreur ou null
 */
const detectAttacks = (value, depth = 0) => {
  if (depth > 10) return null;
  if (typeof value === 'string') {
    // Vérifier les patterns NoSQL
    for (const pattern of ATTACK_PATTERNS.nosqlInjection) {
      if (pattern.test(value)) {
        return 'Pattern d\'injection NoSQL détecté';
      }
    }
    // Vérifier les patterns SQL
    for (const pattern of ATTACK_PATTERNS.sqlInjection) {
      if (pattern.test(value)) {
        return 'Pattern d\'injection SQL détecté';
      }
    }
    // Vérifier les patterns XSS
    for (const pattern of ATTACK_PATTERNS.xss) {
      if (pattern.test(value)) {
        return 'Pattern XSS détecté';
      }
    }
  }
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    for (const val of Object.values(value)) {
      const result = detectAttacks(val, depth + 1);
      if (result) return result;
    }
  }
  return null;
};

/**
 * Middleware de validation et nettoyage des entrées
 */
const inputValidationMiddleware = (req, res, next) => {
  // 1. Valider Content-Type pour les requêtes avec body
  if (req.method !== 'GET' && req.method !== 'DELETE' && req.body) {
    const contentType = req.get('content-type') || '';
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
      return res.status(415).json({
        success: false,
        message: 'Content-Type non supporté. Utilisez application/json.',
      });
    }
  }

  // 2. Valider Content-Length
  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: `Payload trop volumineux. Maximum: ${maxSize / 1024 / 1024}MB.`,
    });
  }

  // 3. Détecter les patterns d'attaque
  if (req.body) {
    const attackDetected = detectAttacks(req.body);
    if (attackDetected) {
      return res.status(400).json({
        success: false,
        message: 'Entrée invalide détectée.',
        detail: attackDetected,
      });
    }
  }
  if (req.query) {
    const attackDetected = detectAttacks(req.query);
    if (attackDetected) {
      return res.status(400).json({
        success: false,
        message: 'Paramètre de requête invalide.',
        detail: attackDetected,
      });
    }
  }

  // 4. Nettoyer les entrées (XSS)
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = {
  inputValidationMiddleware,
  sanitizeString,
  sanitizeObject,
  detectAttacks,
};
