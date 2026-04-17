const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;

  // categories
  const tradeSchema = require('./features/categories/model/trade.schema.js');
  const Trade = getModel(appName, 'Trade', tradeSchema);
  const tradeDocs = [
    { label: 'Plomberie', name: 'plomberie' },
    { label: 'Électricité', name: 'electricite' },
    { label: 'Maçonnerie', name: 'maconnerie' }
  ];
  
  for (const doc of tradeDocs) {
    const existing = await Trade.findOne({ name: doc.name });
    if (!existing) {
      const created = await Trade.create(doc);
      count++;
      await logSeed({
        appName,
        feature: 'categories',
        modelName: 'Trade',
        schemaPath: path.join(__dirname, 'features', 'categories', 'model', 'trade.schema.js'),
        ids: [created._id],
      });
    }
  }

  // professionals
  const professionalsSchema = require('./features/professionals/model/professional.schema.js');
  const Professionals = getModel(appName, 'Professional', professionalsSchema);
  const professionalsDocs = [
    { label: 'Jean Plombier', name: 'Jean', email: 'jean@test.com', phone: '+242060000001' },
    { label: 'Paul Électricien', name: 'Paul', email: 'paul@test.com', phone: '+242060000002' }
  ];
  
  for (const doc of professionalsDocs) {
    const existing = await Professionals.findOne({ email: doc.email });
    if (!existing) {
      const created = await Professionals.create(doc);
      count++;
      await logSeed({
        appName,
        feature: 'professionals',
        modelName: 'Professional',
        schemaPath: path.join(__dirname, 'features', 'professionals', 'model', 'professional.schema.js'),
        ids: [created._id],
      });
    }
  }

  return { count };
};
