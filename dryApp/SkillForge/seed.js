const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  
  const features = ['categories', 'courses', 'ebooks', 'students', 'orders', 'reviews'];
  for (const featureName of features) {
    try {
      const schema = require(`./features/${featureName}/model/${featureName}.schema`);
      const modelName = featureName.charAt(0).toUpperCase() + featureName.slice(1);
      const Model = getModel(appName, modelName, schema);
      
      const docs = [];
      for (let i = 1; i <= 3; i++) {
        docs.push({
          label: `Exemple ${featureName} ${i}`,
          nom: `Exemple Nom ${i}`,
          titre: `Exemple Titre ${i}`
        });
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
      // On ignore silencieusement car certains modeles n'ont pas forcement titre/nom
    }
  }

  return { count };
};
