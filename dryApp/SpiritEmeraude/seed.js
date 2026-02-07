const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  // atelier
  const atelierSchema = require('./features/atelier/model/atelier.schema.js');
  const Atelier = getModel(appName, 'Atelier', atelierSchema);
  const atelierDocs = [
  {
    "label": "Exemple atelier 1"
  },
  {
    "label": "Exemple atelier 2"
  },
  {
    "label": "Exemple atelier 3"
  }
];
  const atelierCreated = await Atelier.insertMany(atelierDocs);
  count += atelierCreated.length;
  await logSeed({
    appName,
    feature: 'atelier',
    modelName: 'Atelier',
    schemaPath: path.join(__dirname, 'features', 'atelier', 'model', 'atelier.schema.js'),
    ids: atelierCreated.map((d) => d._id),
  });

  // contact
  const contactSchema = require('./features/contact/model/contact.schema.js');
  const Contact = getModel(appName, 'Contact', contactSchema);
  const contactDocs = [
  {
    "label": "Exemple contact 1"
  },
  {
    "label": "Exemple contact 2"
  },
  {
    "label": "Exemple contact 3"
  }
];
  const contactCreated = await Contact.insertMany(contactDocs);
  count += contactCreated.length;
  await logSeed({
    appName,
    feature: 'contact',
    modelName: 'Contact',
    schemaPath: path.join(__dirname, 'features', 'contact', 'model', 'contact.schema.js'),
    ids: contactCreated.map((d) => d._id),
  });

  // formation
  const formationSchema = require('./features/formation/model/formation.schema.js');
  const Formation = getModel(appName, 'Formation', formationSchema);
  const formationDocs = [
  {
    "label": "Exemple formation 1"
  },
  {
    "label": "Exemple formation 2"
  },
  {
    "label": "Exemple formation 3"
  }
];
  const formationCreated = await Formation.insertMany(formationDocs);
  count += formationCreated.length;
  await logSeed({
    appName,
    feature: 'formation',
    modelName: 'Formation',
    schemaPath: path.join(__dirname, 'features', 'formation', 'model', 'formation.schema.js'),
    ids: formationCreated.map((d) => d._id),
  });

  // gallery
  const gallerySchema = require('./features/gallery/model/gallery.schema.js');
  const Gallery = getModel(appName, 'Gallery', gallerySchema);
  const galleryDocs = [
  {
    "label": "Exemple gallery 1"
  },
  {
    "label": "Exemple gallery 2"
  },
  {
    "label": "Exemple gallery 3"
  }
];
  const galleryCreated = await Gallery.insertMany(galleryDocs);
  count += galleryCreated.length;
  await logSeed({
    appName,
    feature: 'gallery',
    modelName: 'Gallery',
    schemaPath: path.join(__dirname, 'features', 'gallery', 'model', 'gallery.schema.js'),
    ids: galleryCreated.map((d) => d._id),
  });

  // impact
  const impactSchema = require('./features/impact/model/impact.schema.js');
  const Impact = getModel(appName, 'Impact', impactSchema);
  const impactDocs = [
  {
    "label": "Exemple impact 1"
  },
  {
    "label": "Exemple impact 2"
  },
  {
    "label": "Exemple impact 3"
  }
];
  const impactCreated = await Impact.insertMany(impactDocs);
  count += impactCreated.length;
  await logSeed({
    appName,
    feature: 'impact',
    modelName: 'Impact',
    schemaPath: path.join(__dirname, 'features', 'impact', 'model', 'impact.schema.js'),
    ids: impactCreated.map((d) => d._id),
  });

  // product
  const productSchema = require('./features/product/model/product.schema.js');
  const Product = getModel(appName, 'Product', productSchema);
  const productDocs = [
  {
    "label": "Exemple product 1"
  },
  {
    "label": "Exemple product 2"
  },
  {
    "label": "Exemple product 3"
  }
];
  const productCreated = await Product.insertMany(productDocs);
  count += productCreated.length;
  await logSeed({
    appName,
    feature: 'product',
    modelName: 'Product',
    schemaPath: path.join(__dirname, 'features', 'product', 'model', 'product.schema.js'),
    ids: productCreated.map((d) => d._id),
  });

  return { count };
};
