const CinetPayProvider = require('./providers/cinetpay.provider');
const StripeProvider = require('./providers/stripe.provider');
const MonerooProvider = require('./providers/moneroo.provider');
const AirtelProvider = require('./providers/airtel.provider');
const MtnProvider = require('./providers/mtn.provider');

class PaymentFactory {
    static getProvider(providerName, config) {
        switch (providerName.toLowerCase()) {
            case 'cinetpay':
                return new CinetPayProvider(config);
            case 'stripe':
                return new StripeProvider(config);
            case 'moneroo':
            case 'moneor': // Alias pour compatibilité
                return new MonerooProvider(config);
            case 'airtel':
            case 'airtelmoney':
                return new AirtelProvider(config);
            case 'mtn':
            case 'mtnmomo':
            case 'mobilemoney':
                return new MtnProvider(config);
            default:
                throw new Error(`Fournisseur de paiement non supporté : ${providerName}`);
        }
    }
}

module.exports = PaymentFactory;
