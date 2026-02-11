const logger = require('../../../utils/logging/logger');

/**
 * Interface de base pour tous les fournisseurs de paiement
 */
class BasePaymentProvider {
    constructor(config) {
        // Attention: Ne jamais logger la config entière car elle contient des secrets
        this.config = config;
    }

    /**
     * Initialise un paiement
     * @param {Object} params { amount, currency, transactionId, customerEmail, description }
     */
    async initPayment(params) {
        throw new Error('Method initPayment() must be implemented');
    }

    /**
     * Vérifie le statut d'un paiement
     * @param {String} transactionId 
     */
    async verifyPayment(transactionId) {
        throw new Error('Method verifyPayment() must be implemented');
    }

    log(message, type = 'info') {
        logger(`[Payment] ${message}`, type);
    }
}

module.exports = BasePaymentProvider;
