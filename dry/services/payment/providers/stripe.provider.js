const BasePaymentProvider = require('./base.provider');
const Stripe = require('stripe');

class StripeProvider extends BasePaymentProvider {
    constructor(config) {
        super(config);
        // config attendu: { secretKey }
        this.stripe = Stripe(config.secretKey);
    }

    async initPayment({ amount, currency = 'eur', transactionId, customerEmail, description, returnUrl }) {
        try {
            // Stripe utilise les centimes
            const amountInCents = Math.round(amount * 100);

            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: description || 'Produit',
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${returnUrl}?canceled=true`,
                client_reference_id: transactionId,
                customer_email: customerEmail,
            });

            return {
                success: true,
                paymentUrl: session.url,
                sessionId: session.id,
                apiResponse: session
            };
        } catch (error) {
            console.error('Stripe Init Error:', error.message);
            throw new Error(`Erreur initialisation Stripe: ${error.message}`);
        }
    }

    async verifyPayment(sessionId) {
        try {
            const session = await this.stripe.checkout.sessions.retrieve(sessionId);
            
            if (session.payment_status === 'paid') {
                 return {
                    success: true,
                    status: 'COMPLETED',
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    apiResponse: session
                };
            }
            
            return {
                success: false,
                status: 'PENDING',
                apiResponse: session
            };
        } catch (error) {
            console.error('Stripe Verify Error:', error.message);
            throw error;
        }
    }
}

module.exports = StripeProvider;
