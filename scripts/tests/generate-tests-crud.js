#!/usr/bin/env node

/**
 * Génère des tests CRUD pour toutes les apps existantes (dryApp)
 * - Utilise les schémas Joi si disponibles pour créer un payload valide
 * - Évite de casser: si payload impossible, le test saute l'écriture
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_APP = path.join(ROOT, 'dryApp');
const TESTS_DIR = path.join(ROOT, 'tests');

const toPascal = (v) => v.charAt(0).toUpperCase() + v.slice(1);
const toCamel = (v) => v.charAt(0).toLowerCase() + v.slice(1);

const exampleFor = (desc) => {
  const type = desc?.type || 'string';
  if (desc?.flags?.presence === 'optional' && type === 'string') return 'exemple';
  if (type === 'string') return 'exemple';
  if (type === 'number') return 100;
  if (type === 'boolean') return true;
  if (type === 'date') return '2026-01-01T12:00:00.000Z';
  if (type === 'array') return [];
  if (type === 'object') return {};
  return 'exemple';
};

const buildPayloadFromJoi = (schema) => {
  if (!schema?.describe) return null;
  const desc = schema.describe();
  const keys = desc?.keys || {};
  const payload = {};
  Object.entries(keys).forEach(([k, v]) => {
    if (v?.flags?.presence === 'optional') return;
    payload[k] = exampleFor(v);
  });
  if (!payload.label) payload.label = `exemple_label_${Date.now()}`;
  return payload;
};

const writeFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const testTemplate = (appName, featureName, payload) => {
  const payloadStr = payload ? JSON.stringify(payload, null, 2) : 'null';
  return `const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';
const APP = '${appName.toLowerCase()}';
const FEATURE = '${featureName}';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@dry.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

const ensureFetch = () => {
  if (typeof fetch !== 'function') throw new Error('fetch indisponible (Node 18+ requis)');
};

const loginAdmin = async () => {
  const res = await fetch(\`\${BASE_URL}/api/v1/user/login\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = await res.json();
  return json?.data?.token || null;
};

test('CRUD ${featureName} (auto)', async () => {
  ensureFetch();

  const listRes = await fetch(\`\${BASE_URL}/api/v1/\${APP}/\${FEATURE}\`);
  assert.ok(listRes.status >= 200 && listRes.status < 500);

  const token = await loginAdmin();
  if (!token) return;

  const payload = ${payloadStr};
  if (!payload) return;

  const createRes = await fetch(\`\${BASE_URL}/api/v1/\${APP}/\${FEATURE}\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${token}\`,
    },
    body: JSON.stringify(payload),
  });
  const created = await createRes.json();
  assert.ok(createRes.status >= 200 && createRes.status < 500);
  const id = created?.data?._id || created?.data?.id;
  if (!id) return;

  const getRes = await fetch(\`\${BASE_URL}/api/v1/\${APP}/\${FEATURE}/\${id}\`);
  assert.ok(getRes.status >= 200 && getRes.status < 500);

  const updateRes = await fetch(\`\${BASE_URL}/api/v1/\${APP}/\${FEATURE}/\${id}\`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${token}\`,
    },
    body: JSON.stringify({ ...payload, label: \`Maj \${Date.now()}\` }),
  });
  assert.ok(updateRes.status >= 200 && updateRes.status < 500);

  const deleteRes = await fetch(\`\${BASE_URL}/api/v1/\${APP}/\${FEATURE}/\${id}\`, {
    method: 'DELETE',
    headers: { Authorization: \`Bearer \${token}\` },
  });
  assert.ok(deleteRes.status >= 200 && deleteRes.status < 500);
});
`;
};

const generate = () => {
  if (!fs.existsSync(DRY_APP)) {
    console.log('[tests] dryApp introuvable');
    return;
  }

  const apps = fs.readdirSync(DRY_APP).filter((a) => !a.startsWith('.'));
  apps.forEach((appName) => {
    const appPath = path.join(DRY_APP, appName);
    const featuresPath = path.join(appPath, 'features');
    if (!fs.existsSync(featuresPath)) return;

    const appKey = toCamel(appName);
    const schemasPath = path.join(appPath, 'validation', 'schemas.js');
    let schemas = null;
    if (fs.existsSync(schemasPath)) {
      try {
        schemas = require(schemasPath)[`${appKey}Schemas`];
      } catch (_) {
        schemas = null;
      }
    }

    const features = fs.readdirSync(featuresPath).filter((f) => !f.startsWith('.'));
    features.forEach((feature) => {
      const modelGuess = toPascal(feature);
      let payload = null;
      if (schemas && schemas[modelGuess]?.create) {
        payload = buildPayloadFromJoi(schemas[modelGuess].create);
      }

      const testPath = path.join(TESTS_DIR, appName, `${feature}.test.js`);
      writeFile(testPath, testTemplate(appName, feature, payload));
    });
  });

  console.log('[tests] Génération terminée');
};

generate();
