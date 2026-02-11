const BaseProvider = require('./base.provider');
const axios = require('axios');

class AirtelProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://openapi.airtel.africa';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  async getToken() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Airtel Client ID and Client Secret are required for token generation');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/auth/oauth2/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data.access_token;
    } catch (error) {
      this.log(`Airtel Token Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
      throw new Error('Failed to generate Airtel Access Token');
    }
  }

  async initPayment({ amount, currency = 'XAF', transactionId, customerPhone, description }) {
    try {
      if (!customerPhone) {
        throw new Error('Numéro de téléphone requis pour Airtel Money');
      }

      // 1. Obtenir le token
      const token = await this.getToken();

      // 2. Préparer le payload
      const payload = {
        reference: transactionId,
        subscriber: {
          country: 'CG', // Code pays par défaut, pourrait être configurable
          currency: currency,
          msisdn: customerPhone
        },
        transaction: {
          amount: Number(amount),
          country: 'CG',
          currency: currency,
          id: transactionId // ID unique transaction
        }
      };

      this.log(`Airtel Payment Request: ${JSON.stringify(payload)}`, 'info');

      // 3. Envoyer la demande de paiement
      const response = await axios.post(`${this.baseUrl}/merchant/v1/payments/`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Country': 'CG',
          'X-Currency': currency
        }
      });

      const data = response.data.data || response.data;
      
      // Airtel retourne status dans data.transaction.status
      if (data.status && data.status.code === '200') {
          return {
            success: true,
            message: data.status.message || 'Paiement initié',
            providerTransactionId: data.transaction.id,
            status: 'PENDING', // Airtel est souvent synchrone ou asynchrone selon le cas
            apiResponse: data
          };
      } else {
           // Cas où l'API répond 200 mais avec un code erreur métier
           throw new Error(data.status?.message || 'Erreur inconnue Airtel');
      }

    } catch (error) {
      this.log(`Airtel Init Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async verifyPayment(transactionId) {
    try {
        const token = await this.getToken();

        // GET /standard/v1/payments/{id} (Endpoint de vérification peut varier selon les pays, ici standard)
        // Note: La doc Airtel varie, parfois c'est /merchant/v1/payments/{id}
        const response = await axios.get(`${this.baseUrl}/merchant/v1/payments/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Country': 'CG',
                'X-Currency': 'XAF'
            }
        });

        const data = response.data.data;
        const status = data.transaction.status; // TS, TF, TIP...

        return {
            success: status === 'TS', // Transaction Success
            status: status,
            amount: data.transaction.amount,
            currency: data.transaction.currency,
            transactionId,
            apiResponse: data
        };

    } catch (error) {
        this.log(`Airtel Verify Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
        throw error;
    }
  }
}

module.exports = AirtelProvider;