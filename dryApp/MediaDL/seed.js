const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  
  const features = ['downloads', 'batches', 'presets'];
  for (const featureName of features) {
    try {
      const schema = require(`./features/${featureName}/model/${featureName}.schema`);
      const modelName = featureName.charAt(0).toUpperCase() + featureName.slice(1);
      const Model = getModel(appName, modelName, schema);
      
      const docs = [];
      for (let i = 1; i <= 3; i++) {
        const doc = { label: `Exemple ${featureName} ${i}` };
        // On ajoute quelques champs par defaut selon la feature
        if (featureName === 'downloads') doc.url = 'http://example.com/video';
        if (featureName === 'batches') doc.total = 10;
        docs.push(doc);
      }
      
      const created = await Model.insertMany(docs);
      count += created.length;
      
      await logSeed({
        appName,
        feature: featureName,
        modelName,
        schemaPath: path.join(__dirname, 'features', featureName, 'model', `${featureName}.schema.js`),
        ids: created.map(d => d._id),
      });
    } catch (e) {
      console.log(`[seed-MediaDL] Erreur ${featureName}: ${e.message}`);
    }
  }

  return { count };
};
