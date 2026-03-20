const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  
  // 1. Feature: POST
  const postSchema = require('./features/post/model/post.schema');
  const Post = getModel(appName, 'Post', postSchema);
  const postDocs = [];
  for (let i = 1; i <= 3; i++) {
    postDocs.push({
      titre: `exemple_titre_${i}`,
      description: `exemple_description_${i}`,
      label: `Exemple post ${i}`
    });
  }
  const postCreated = await Post.insertMany(postDocs);
  count += postCreated.length;
  await logSeed({
    appName,
    feature: 'post',
    modelName: 'Post',
    schemaPath: path.join(__dirname, 'features', 'post', 'model', 'post.schema.js'),
    ids: postCreated.map((d) => d._id),
  });

  // 2. Feature: ANNONCE
  const annonceSchema = require('./features/annonce/model/annonce.schema');
  const Annonce = getModel(appName, 'Annonce', annonceSchema);
  const annonceDocs = [];
  for (let i = 1; i <= 3; i++) {
    annonceDocs.push({
      titre: `exemple_titre_${i}`,
      description: `exemple_description_${i}`,
      label: `Exemple annonce ${i}`
    });
  }
  const annonceCreated = await Annonce.insertMany(annonceDocs);
  count += annonceCreated.length;
  await logSeed({
    appName,
    feature: 'annonce',
    modelName: 'Annonce',
    schemaPath: path.join(__dirname, 'features', 'annonce', 'model', 'annonce.schema.js'),
    ids: annonceCreated.map((d) => d._id),
  });

  return { count };
};
