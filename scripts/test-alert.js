require('dotenv').config({ path: '../.env' });
const { sendAlert } = require('../dry/services/alert/alert.service');

(async () => {
  try {
    await sendAlert({
      event: 'TEST_ALERT',
      severity: 'warning',
      message: 'Alerte de test depuis Le Pèlerin — système opérationnel.',
      details: {
        app: 'Le Pèlerin',
        env: process.env.NODE_ENV || 'development',
        time: new Date().toISOString(),
      },
    });
    console.log('Alerte de test envoyée avec succès.');
  } catch (err) {
    console.error('Échec envoi alerte de test :', err.message);
    process.exit(1);
  }
})();
