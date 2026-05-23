
const express = require('express');
const { initEncryptionKey } = require('./dryApp/FreeLLM/core/lib/crypto');
const { createKeysRouter } = require('./dryApp/FreeLLM/core/routes/keys');
const mongoose = require('mongoose');
const ApiKeysSchema = require('./dryApp/FreeLLM/features/apiKeys/model/apiKeys.schema');
const SettingsSchema = require('./dryApp/FreeLLM/features/settings/model/settings.schema');

async function test() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect('mongodb://127.0.0.1:27017/dryapi', {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('Connected to MongoDB!');

  const Settings = mongoose.model('FreeLLM_Settings', SettingsSchema);
  await initEncryptionKey(Settings);

  const ApiKeys = mongoose.model('FreeLLM_ApiKeys', ApiKeysSchema);

  const app = express();
  app.use(express.json());
  
  const keysRouter = createKeysRouter(ApiKeys);
  app.use('/api/keys', keysRouter);
  
  app.use((req, res) => {
    console.log('Catch-all route hit for:', req.method, req.path);
    res.status(404).json({ success: false, message: 'Route introuvable' });
  });

  const PORT = 5003;
  app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
    console.log('Test sending POST /api/keys');
  });
}

test().catch(err => console.error('Error:', err));
