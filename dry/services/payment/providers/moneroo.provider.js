const BaseProvider = require('./base.provider');
const axios = require('axios');

class MonerooProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.moneroo.io/v1';
    this.apiKey = config.apiKey; // Secret Key
    
    if (!this.apiKey) {
      this.log('Moneroo API Key (Secret) is missing', 'error');
    }
  }

  /**
   * Initialize a payment via Moneroo
   * Docs: https://docs.moneroo.io/payments/standard-integration
   */
  async initPayment({ amount, currency = 'XAF', transactionId, customerEmail, customerName, customerPhone, description, returnUrl }) {
    try {
      if (!this.apiKey) {
        throw new Error('Moneroo API Key is missing');
      }

      const payload = {
        amount: Number(amount),
        currency: currency,
        description: description || `Order ${transactionId}`,
        customer: {
          email: customerEmail || 'customer@example.com',
          first_name: customerName ? customerName.split(' ')[0] : 'Customer',
          last_name: customerName ? (customerName.split(' ')[1] || 'Name') : 'Name',
          phone: customerPhone
        },
        return_url: returnUrl || this.config.returnUrl || 'http://localhost:3000/payment/callback',
        metadata: {
          transaction_id: transactionId,
          source: 'dry-framework'
        }
      };

      this.log(`Moneroo Init Payload: ${JSON.stringify(payload)}`, 'info');

      const response = await axios.post(`${this.baseUrl}/payments/initialize`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.status === 201 || response.status === 200) {
        // Moneroo returns payment_url in data
        const data = response.data.data || response.data;
        return {
          success: true,
          paymentUrl: data.checkout_url || data.payment_url || data.url, // Adapting to potential response fields
          providerTransactionId: data.id || data.payment_id,
          status: 'PENDING',
          apiResponse: data
        };
      } else {
        throw new Error(`Moneroo API Error: ${response.status}`);
      }

    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      this.log(`Moneroo Init Error: ${errMsg}`, 'error');
      if (error.response?.data) {
        this.log(`Moneroo Error Details: ${JSON.stringify(error.response.data)}`, 'error');
      }
      return {
        success: false,
        error: errMsg
      };
    }
  }

  async verifyPayment(transactionId) {
    try {
        // GET /v1/payments/{id}
        const response = await axios.get(`${this.baseUrl}/payments/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'application/json'
            }
        });

        const data = response.data.data || response.data;
        const status = data.status; // success, failed, pending

        return {
            success: status === 'success' || status === 'completed',
            status: status.toUpperCase(),
            amount: data.amount,
            currency: data.currency,
            transactionId,
            apiResponse: data
        };

    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      this.log(`Moneroo Verify Error: ${errMsg}`, 'error');
      return {
        success: false,
        error: errMsg
      };
    }
  }
}

module.exports = MonerooProvider;
