const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_APP = path.join(ROOT, 'dryApp');

const toPascal = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const toCamel = (value) => value.charAt(0).toLowerCase() + value.slice(1);

const exampleFromJoi = (desc) => {
  const type = desc?.type || 'string';
  if (type === 'string') {
    const lower = (desc?.flags?.label || '').toLowerCase();
    if (lower.includes('email')) return 'demo@example.com';
    if (lower.includes('tel')) return '+22501020304';
    return 'exemple';
  }
  if (type === 'number') return 100;
  if (type === 'boolean') return true;
  if (type === 'date') return '2026-01-01T12:00:00.000Z';
  if (type === 'array') return [];
  if (type === 'object') return {};
  return 'exemple';
};

const buildSeedDoc = (schema, index, feature) => {
  const payload = {};
  if (schema?.describe) {
    const desc = schema.describe();
    const keys = desc?.keys || {};
    Object.keys(keys).forEach((k) => {
      const d = keys[k];
      payload[k] = exampleFromJoi({ ...d, flags: { ...(d.flags || {}), label: k } });
      if (typeof payload[k] === 'string') {
        payload[k] = `${payload[k]}_${index}`;
      }
    });
  }
  if (!payload.label) payload.label = `Exemple ${feature} ${index}`;
  return payload;
};

const buildSeedFile = (appName, features, schemasByModel) => {
  const blocks = features.map((feature) => {
    const modelName = toPascal(feature);
    const schema = schemasByModel?.[modelName]?.create || null;
    const docs = [1, 2, 3].map((i) => buildSeedDoc(schema, i, feature));
    const schemaPath = `./features/${feature}/model/${feature}.schema.js`;

    return `  // ${feature}
  const ${feature}Schema = require('${schemaPath}');
  const ${modelName} = getModel(appName, '${modelName}', ${feature}Schema);
  const ${feature}Docs = ${JSON.stringify(docs, null, 2)};
  const ${feature}Created = await ${modelName}.insertMany(${feature}Docs);
  count += ${feature}Created.length;
  await logSeed({
    appName,
    feature: '${feature}',
    modelName: '${modelName}',
    schemaPath: path.join(__dirname, 'features', '${feature}', 'model', '${feature}.schema.js'),
    ids: ${feature}Created.map((d) => d._id),
  });
`;
  });

  return `const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
${blocks.join('\n')}
  return { count };
};
`;
};

const getApps = () => {
  if (!fs.existsSync(DRY_APP)) return [];
  return fs.readdirSync(DRY_APP).filter((a) => !a.startsWith('.'));
};

const getFeatures = (appName) => {
  const featuresPath = path.join(DRY_APP, appName, 'features');
  if (!fs.existsSync(featuresPath)) return [];
  return fs.readdirSync(featuresPath).filter((f) => !f.startsWith('.'));
};

const loadSchemas = (appName) => {
  try {
    const schemasPath = path.join(DRY_APP, appName, 'validation', 'schemas.js');
    if (!fs.existsSync(schemasPath)) return null;
    const appKey = toCamel(appName);
    const mod = require(schemasPath);
    return mod[`${appKey}Schemas`] || null;
  } catch (e) {
    return null;
  }
};

const main = () => {
  const apps = getApps();
  if (!apps.length) {
    console.log('[seed-refresh] aucune app detectee');
    return;
  }

  apps.forEach((appName) => {
    const features = getFeatures(appName);
    const schemas = loadSchemas(appName);
    const content = buildSeedFile(appName, features, schemas);
    const outPath = path.join(DRY_APP, appName, 'seed.js');
    fs.writeFileSync(outPath, content, 'utf8');
    console.log('[seed-refresh] ok', appName);
  });
};

main();
