/**
 * Middleware de Versioning d'API
 * Gère le versioning des endpoints, la compatibilité et les avertissements de dépréciation
 * @module dry/middlewares/apiVersion.middleware
 */

const config = require('../../config/database');

/**
 * Configuration des versions API
 * Chaque version définit sa date de sunset et son statut
 */
const API_VERSIONS = {
  v1: {
    prefix: '/api/v1',
    status: 'current',        // current | deprecated | sunset
    deprecatedSince: null,
    sunsetDate: process.env.API_V1_SUNSET || '2027-06-06',
    changelog: 'Version initiale de l\'API',
  },
  // Réservé pour les versions futures
  // v2: {
  //   prefix: '/api/v2',
  //   status: 'beta',
  //   deprecatedSince: null,
  //   sunsetDate: null,
  //   changelog: 'Version avec améliorations',
  // },
};

/**
 * Parse la version depuis une route
 * @param {string} url - URL de la requête
 * @returns {string|null} Version détectée ou null
 */
const detectVersion = (url) => {
  if (!url) return null;
  const match = url.match(/\/api\/(v\d+)\//);
  return match ? match[1] : null;
};

/**
 * Middleware de versioning d'API
 * Ajoute les headers de version et de dépréciation aux réponses
 */
const apiVersionMiddleware = (req, res, next) => {
  const version = detectVersion(req.originalUrl);

  if (version) {
    const versionConfig = API_VERSIONS[version];

    // Ajouter les headers de version
    res.setHeader('API-Version', version);
    res.setHeader('X-API-Version', version);

    if (versionConfig) {
      // Avertissement de dépréciation
      if (versionConfig.status === 'deprecated' || versionConfig.status === 'sunset') {
        res.setHeader('API-Deprecated', 'true');
        res.setHeader('API-Sunset', versionConfig.sunsetDate);
        res.setHeader('Warning', `299 - "La version ${version} est dépréciée. Migration recommandée avant le ${versionConfig.sunsetDate}."`);
      } else {
        res.setHeader('API-Deprecated', 'false');
      }

      // Ajouter les infos de version à la requête
      req.apiVersion = version;
      req.apiVersionConfig = versionConfig;
    }
  }

  next();
};

/**
 * Middleware de vérification de compatibilité
 * Bloque les requêtes vers des versions sunset
 */
const requireApiVersion = (requiredVersion) => {
  return (req, res, next) => {
    const version = detectVersion(req.originalUrl);

    if (!version) {
      return res.status(400).json({
        success: false,
        message: 'Version API requise. Utilisez /api/v1/...',
      });
    }

    const versionConfig = API_VERSIONS[version];
    if (!versionConfig) {
      return res.status(404).json({
        success: false,
        message: `Version API '${version}' non supportée. Versions disponibles: ${Object.keys(API_VERSIONS).join(', ')}`,
      });
    }

    if (versionConfig.status === 'sunset') {
      return res.status(410).json({
        success: false,
        message: `La version ${version} n'est plus supportée depuis le ${versionConfig.sunsetDate}. Veuillez migrer vers une version plus récente.`,
        sunsetDate: versionConfig.sunsetDate,
        supportedVersions: Object.keys(API_VERSIONS).filter(v => API_VERSIONS[v].status !== 'sunset'),
      });
    }

    if (requiredVersion && version !== requiredVersion) {
      // Version non requise mais compatible - juste un warning
      console.warn(`[API Version] Requête sur ${version} alors que ${requiredVersion} est recommandé`);
    }

    next();
  };
};

module.exports = {
  apiVersionMiddleware,
  requireApiVersion,
  detectVersion,
  API_VERSIONS,
};
