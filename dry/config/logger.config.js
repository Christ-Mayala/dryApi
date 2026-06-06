/**
 * Configuration Winston Logger
 * Logging structuré avec niveaux, rotation quotidienne et masquage des données sensibles
 * @module dry/config/logger.config
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('winston-daily-rotate-file');

const LOG_DIR = path.join(__dirname, '../../logs');

// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Niveaux de log personnalisés
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

/**
 * Couleurs pour les niveaux de log (console)
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'gray',
};

winston.addColors(colors);

/**
 * Champs sensibles à masquer dans les logs
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'pass',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'secret',
  'jwt',
  'session',
  'creditCard',
  'credit_card',
  'cvv',
  'ssn',
  'otp',
  'code',
  'resetCode',
  'smtp_password',
  'stripe_secret_key',
]);

/**
 * Masque les champs sensibles récursivement
 * @param {object} obj - Objet à nettoyer
 * @param {number} depth - Profondeur de récursion
 * @returns {object} Objet nettoyé
 */
const maskSensitiveData = (obj, depth = 0) => {
  if (depth > 5) return '[DEEP_TRUNCATED]';
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = maskSensitiveData(value, depth + 1);
    } else if (typeof value === 'string' && value.length > 1000) {
      sanitized[key] = value.slice(0, 1000) + '… [TRUNCATED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Format structuré JSON pour les fichiers
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    // Masquer les données sensibles dans metadata
    if (info.metadata) {
      info.metadata = maskSensitiveData(info.metadata);
    }
    return info;
  })(),
  winston.format.json()
);

/**
 * Format colorisé pour la console (développement)
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, action, duration_ms, status, requestId, ...meta }) => {
    const serviceTag = service ? `[${service}]` : '';
    const actionTag = action ? `[${action}]` : '';
    const durationTag = duration_ms !== undefined ? ` ${duration_ms}ms` : '';
    const statusTag = status ? ` ${status}` : '';
    const reqTag = requestId ? ` ${requestId}` : '';
    const metaStr = Object.keys(meta).length > 0 ? `\n  ${JSON.stringify(maskSensitiveData(meta), null, 2)}` : '';

    return `${timestamp} ${level}${reqTag}${serviceTag}${actionTag}${statusTag}${durationTag}: ${message}${metaStr}`;
  })
);

/**
 * Transport fichier avec rotation quotidienne (erreurs)
 */
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  format: jsonFormat,
  zippedArchive: true,
});

/**
 * Transport fichier avec rotation quotidienne (tous les logs)
 */
const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'info',
  maxSize: '50m',
  maxFiles: '14d',
  format: jsonFormat,
  zippedArchive: true,
});

/**
 * Transport fichier avec rotation quotidienne (debug)
 */
const debugFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(LOG_DIR, 'debug-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'debug',
  maxSize: '50m',
  maxFiles: '7d',
  format: jsonFormat,
  zippedArchive: true,
});

/**
 * Transport console
 */
const consoleTransport = new winston.transports.Console({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: consoleFormat,
});

/**
 * Crée et retourne l'instance Winston logger
 * @returns {winston.Logger} Instance du logger
 */
const createLogger = () => {
  const logger = winston.createLogger({
    levels,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transports: [
      errorFileTransport,
      combinedFileTransport,
      debugFileTransport,
      consoleTransport,
    ],
    // Ne pas quitter le processus en cas d'erreur de log
    exitOnError: false,
  });

  /**
   * Crée un logger contextualisé pour un service spécifique
   * @param {string} service - Nom du service
   * @returns {object} Logger avec contexte
   */
  logger.createServiceLogger = (service) => {
    return {
      error: (message, meta = {}) => logger.error(message, { ...meta, service }),
      warn: (message, meta = {}) => logger.warn(message, { ...meta, service }),
      info: (message, meta = {}) => logger.info(message, { ...meta, service }),
      debug: (message, meta = {}) => logger.debug(message, { ...meta, service }),
      trace: (message, meta = {}) => logger.log('trace', message, { ...meta, service }),
    };
  };

  return logger;
};

// Instance singleton
const logger = createLogger();

module.exports = {
  logger,
  maskSensitiveData,
  createLogger,
};
