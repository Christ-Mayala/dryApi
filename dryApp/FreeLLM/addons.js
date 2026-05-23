const { getUnifiedApiKey } = require('./index');

function FreeLLMAddon(app, appName) {
  console.log(`📦 FreeLLM Addon loaded for app: ${appName}`);
  
  // Get unified API key for display
  const apiKey = getUnifiedApiKey();
  if (apiKey) {
    console.log(`🔑 FreeLLM Unified API Key: ${apiKey.substring(0, 8)}...`);
  }
  
  // Add any additional Express middleware here if needed
  app.use((req, res, next) => {
    // If you need any custom middleware for FreeLLM, add it here
    next();
  });
}

module.exports = FreeLLMAddon;
