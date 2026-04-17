const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  // severgold
  const severgoldSchema = require('./features/severgold/model/severgold.schema');
  const Severgold = getModel(appName, 'Severgold', severgoldSchema);
  const severgoldDocs = [
  {
    Mays: 'exemple_Mays_1',
    label: `Exemple severgold ${index}`
  },
  {
    Mays: 'exemple_Mays_2',
    label: `Exemple severgold ${index}`
  },
  {
    Mays: 'exemple_Mays_3',
    label: `Exemple severgold ${index}`
  }
  ];
  const severgoldCreated = await Severgold.insertMany(severgoldDocs);
  count += severgoldCreated.length;
  await logSeed({
    appName,
    feature: 'severgold',
    modelName: 'Severgold',
    schemaPath: path.join(__dirname, 'features', 'severgold', 'model', 'severgold.schema.js'),
    ids: severgoldCreated.map((d) => d._id),
  });

  return { count };
};
