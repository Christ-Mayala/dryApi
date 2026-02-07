const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logging/logger');

class TenantValidationService {
  static getTenants() {
    const dryAppPath = path.join(__dirname, '../../../dryApp');
    if (!fs.existsSync(dryAppPath)) return [];
    return fs.readdirSync(dryAppPath).filter((item) => {
      const itemPath = path.join(dryAppPath, item);
      return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
    });
  }

  /**
   * Valide l'existence d'un tenant
   */
  static validateTenant(tenantId) {
    const validTenants = this.getTenants();

    if (!tenantId || !validTenants.includes(tenantId)) {
      logger(`Tentative d'acces avec tenant invalide: ${tenantId}`, 'warning');
      return false;
    }

    return true;
  }

  /**
   * Valide le format du tenant ID
   */
  static validateTenantFormat(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') {
      return false;
    }

    // Le tenant doit etre alphanumerique avec possibilite de tirets
    const tenantPattern = /^[a-zA-Z][a-zA-Z0-9-]*$/;
    return tenantPattern.test(tenantId) && tenantId.length >= 2 && tenantId.length <= 50;
  }

  /**
   * Middleware pour valider le tenant dans les routes
   */
  static tenantValidator(req, res, next) {
    const tenant = req.params.tenant || req.appName;

    if (!this.validateTenant(tenant)) {
      return res.status(400).json({
        success: false,
        message: 'Application (tenant) invalide ou non reconnue',
      });
    }

    req.validatedTenant = tenant;
    next();
  }

  /**
   * Obtenir la configuration specifique du tenant
   */
  static getTenantConfig(tenantId) {
    const dryAppPath = path.join(__dirname, '../../../dryApp');
    const appPath = path.join(dryAppPath, tenantId);
    if (!fs.existsSync(appPath)) return null;

    const featuresPath = path.join(appPath, 'features');
    let features = [];
    if (fs.existsSync(featuresPath)) {
      features = fs.readdirSync(featuresPath).filter((f) => !f.startsWith('.'));
    }

    return {
      name: tenantId,
      dbName: `${tenantId}DB`,
      features,
    };
  }

  /**
   * Verifier si une feature est disponible pour un tenant
   */
  static isFeatureAvailable(tenantId, feature) {
    const config = this.getTenantConfig(tenantId);
    if (!config) return false;
    return config.features.includes(feature);
  }
}

module.exports = TenantValidationService;
