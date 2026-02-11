const BasePaymentProvider = require('./base.provider');
const axios = require('axios');

class CinetPayProvider extends BasePaymentProvider {
    constructor(config) {
        super(config);
        // config attendu: { apiKey, siteId, baseUrl (opt) }
        this.baseUrl = config.baseUrl || 'https://api-checkout.cinetpay.com/v2/payment';
    }

    async initPayment({ amount, currency = 'XAF', transactionId, customerEmail, description, customerName, customerSurname }) {
        try {
            const payload = {
                apikey: this.config.apiKey,
                site_id: this.config.siteId,
                transaction_id: transactionId,
                amount: amount,
                currency: currency,
                description: description || 'Paiement',
                customer_id: customerEmail, // Souvent l'email sert d'ID
                customer_name: customerName || 'Client',
                customer_surname: customerSurname || 'Inconnu',
                notify_url: this.config.notifyUrl,
                return_url: this.config.returnUrl,
                channels: 'ALL',
                metadata: 'DRY_FRAMEWORK'
            };

            const response = await axios.post(this.baseUrl, payload);
            
            if (response.data.code === '201') {
                return {
                    success: true,
                    paymentUrl: response.data.data.payment_url,
                    apiResponse: response.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || response.data.description
                };
            }
        } catch (error) {
            this.log(`CinetPay Init Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
            throw new Error('Erreur initialisation CinetPay');
        }
    }

    async verifyPayment(transactionId) {
        try {
            const payload = {
                apikey: this.config.apiKey,
                site_id: this.config.siteId,
                transaction_id: transactionId
            };

            const response = await axios.post(`${this.baseUrl}/check`, payload);
            
            const data = response.data.data;
            if (response.data.code === '00') {
                return {
                    success: true,
                    status: 'COMPLETED', // Standardisé
                    amount: data.amount,
                    currency: data.currency,
                    apiResponse: data
                };
            } else {
                 return {
                    success: false,
                    status: 'FAILED',
                    error: response.data.message
                };
            }
        } catch (error) {
            this.log(`CinetPay Verify Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
            throw error;
        }
    }
}

module.exports = CinetPayProvider;
