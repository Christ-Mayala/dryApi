const BaseProvider = require('./base.provider');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class MtnProvider extends BaseProvider {
  constructor(config) {
    super(config);
    // Sandbox par défaut, à changer en prod
    this.baseUrl = config.baseUrl || 'https://sandbox.momodeveloper.mtn.com'; 
    this.subscriptionKey = config.subscriptionKey;
    this.apiUser = config.apiUser; // UUID v4 généré lors de la création de l'utilisateur API
    this.apiKey = config.apiKey;   // Clé générée associée à l'utilisateur
    this.targetEnvironment = config.targetEnvironment || 'sandbox'; // sandbox ou mtncongo, mtncameroon...
  }

  async getToken() {
    if (!this.apiUser || !this.apiKey) {
      throw new Error('MTN API User and API Key are required for token generation');
    }

    const auth = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
    
    try {
      const response = await axios.post(`${this.baseUrl}/collection/token/`, null, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey
        }
      });
      return response.data.access_token;
    } catch (error) {
      this.log(`MTN Token Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
      throw new Error('Failed to generate MTN Access Token');
    }
  }

  async initPayment({ amount, currency = 'XAF', transactionId, customerPhone, description }) {
    try {
      if (!this.subscriptionKey) {
          throw new Error('MTN MoMo Subscription Key missing');
      }

      if (!customerPhone) {
        throw new Error('Numéro de téléphone requis pour MTN MoMo');
      }

      // 1. Obtenir le token
      const token = await this.getToken();

      // 2. Préparer la requête
      const referenceId = uuidv4(); // ID unique pour cette requête spécifique à MTN
      const payload = {
        amount: String(amount),
        currency: currency,
        externalId: transactionId, // ID de notre système
        payer: {
          partyIdType: 'MSISDN',
          partyId: customerPhone
        },
        payerMessage: description || 'Paiement',
        payeeNote: 'Merci'
      };

      // 3. Envoyer la demande de paiement (Request to Pay)
      const response = await axios.post(`${this.baseUrl}/collection/v1_0/requesttopay`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 202) {
        return {
          success: true,
          message: 'Demande de paiement acceptée (Push envoyée)',
          providerTransactionId: referenceId, // C'est cet ID qu'on utilise pour vérifier le statut
          status: 'PENDING',
          apiResponse: response.data
        };
      } else {
        throw new Error(`MTN API Error: ${response.status}`);
      }

    } catch (error) {
      this.log(`MTN Init Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async verifyPayment(transactionId) {
    try {
        // transactionId ici DOIT être le X-Reference-Id retourné lors de l'init
        const token = await this.getToken();

        const response = await axios.get(`${this.baseUrl}/collection/v1_0/requesttopay/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Target-Environment': this.targetEnvironment,
                'Ocp-Apim-Subscription-Key': this.subscriptionKey
            }
        });

        const data = response.data;
        // Status: SUCCESSFUL, FAILED, PENDING
        const success = data.status === 'SUCCESSFUL';

        return {
            success,
            status: data.status,
            amount: data.amount,
            currency: data.currency,
            transactionId,
            apiResponse: data
        };

    } catch (error) {
        this.log(`MTN Verify Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`, 'error');
        throw error;
    }
  }
}

module.exports = MtnProvider;