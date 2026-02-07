const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  // admin
  const adminSchema = require('./features/admin/model/admin.schema.js');
  const Admin = getModel(appName, 'Admin', adminSchema);
  const adminDocs = [
  {
    "label": "Exemple admin 1"
  },
  {
    "label": "Exemple admin 2"
  },
  {
    "label": "Exemple admin 3"
  }
];
  const adminCreated = await Admin.insertMany(adminDocs);
  count += adminCreated.length;
  await logSeed({
    appName,
    feature: 'admin',
    modelName: 'Admin',
    schemaPath: path.join(__dirname, 'features', 'admin', 'model', 'admin.schema.js'),
    ids: adminCreated.map((d) => d._id),
  });

  // categories
  const categoriesSchema = require('./features/categories/model/categories.schema.js');
  const Categories = getModel(appName, 'Categories', categoriesSchema);
  const categoriesDocs = [
  {
    "label": "Exemple categories 1"
  },
  {
    "label": "Exemple categories 2"
  },
  {
    "label": "Exemple categories 3"
  }
];
  const categoriesCreated = await Categories.insertMany(categoriesDocs);
  count += categoriesCreated.length;
  await logSeed({
    appName,
    feature: 'categories',
    modelName: 'Categories',
    schemaPath: path.join(__dirname, 'features', 'categories', 'model', 'categories.schema.js'),
    ids: categoriesCreated.map((d) => d._id),
  });

  // professionals
  const professionalsSchema = require('./features/professionals/model/professionals.schema.js');
  const Professionals = getModel(appName, 'Professionals', professionalsSchema);
  const professionalsDocs = [
  {
    "label": "Exemple professionals 1"
  },
  {
    "label": "Exemple professionals 2"
  },
  {
    "label": "Exemple professionals 3"
  }
];
  const professionalsCreated = await Professionals.insertMany(professionalsDocs);
  count += professionalsCreated.length;
  await logSeed({
    appName,
    feature: 'professionals',
    modelName: 'Professionals',
    schemaPath: path.join(__dirname, 'features', 'professionals', 'model', 'professionals.schema.js'),
    ids: professionalsCreated.map((d) => d._id),
  });

  // reports
  const reportsSchema = require('./features/reports/model/reports.schema.js');
  const Reports = getModel(appName, 'Reports', reportsSchema);
  const reportsDocs = [
  {
    "label": "Exemple reports 1"
  },
  {
    "label": "Exemple reports 2"
  },
  {
    "label": "Exemple reports 3"
  }
];
  const reportsCreated = await Reports.insertMany(reportsDocs);
  count += reportsCreated.length;
  await logSeed({
    appName,
    feature: 'reports',
    modelName: 'Reports',
    schemaPath: path.join(__dirname, 'features', 'reports', 'model', 'reports.schema.js'),
    ids: reportsCreated.map((d) => d._id),
  });

  return { count };
};
