
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

const buildPayload = (schema) => {
  if (!schema?.describe) return { label: 'exemple_label' };
  const desc = schema.describe();
  const keys = desc?.keys || {};
  const payload = {};
  Object.keys(keys).forEach((k) => {
    const d = keys[k];
    payload[k] = exampleFromJoi({ ...d, flags: { ...(d.flags || {}), label: k } });
  });
  if (!payload.label) payload.label = 'exemple_label';
  return payload;
};

const buildReadme = (appName, features, schemasByModel) => {
  const endpoints = features.map((f) => `- /api/v1/${appName.toLowerCase()}/${f}`).join('\n');
  const perFeature = features
    .map((f) => {
      const modelName = toPascal(f);
      const schema = schemasByModel?.[modelName]?.create || null;
      const payload = JSON.stringify(buildPayload(schema), null, 2);
      return `### ${f}
- GET /api/v1/${appName.toLowerCase()}/${f}
- POST /api/v1/${appName.toLowerCase()}/${f}
- GET /api/v1/${appName.toLowerCase()}/${f}/:id
- PUT /api/v1/${appName.toLowerCase()}/${f}/:id
- DELETE /api/v1/${appName.toLowerCase()}/${f}/:id

Exemple payload:
\`\`\`json
${payload}
\`\`\``;
    })
    .join('\n\n');

  return `# ${appName}

Application generee avec le Generateur DRY (mode professionnel par defaut).

## Demarrage express (debutant)
1. Installe les dependances: \`npm install\`
2. Cree ton fichier .env a partir de \`.env.exemple\`
3. Demarre le serveur: \`npm run dev\`
4. Verifie la sante: \`GET /\`
5. Ouvre la doc Swagger: \`http://localhost:5000/api-docs\`

## Endpoints principaux
${endpoints}

## Details par feature (routes + payloads)
${perFeature}

## Comprendre la securite (simple)
1. Les routes d'ecriture utilisent \`protect\` + \`authorize('admin')\`
2. La validation Joi bloque les donnees invalides
3. Cache + audit sont actives sur les routes sensibles
4. CSP/HSTS/ReferrerPolicy sont durcis en production

## Etapes recommandees (pro)
1. Definit \`ALLOWED_ORIGINS\` en production (pas de \`*\`)
2. Definis un \`JWT_SECRET\` long (>= 32 caracteres)
3. Lance le seeder global pour creer un admin
4. Active le monitoring via \`HEALTH_MONITOR_INTERVAL_MS\`

## Password Reset (injecte automatiquement)
1. POST /api/v1/${appName.toLowerCase()}/password-reset/request
2. POST /api/v1/${appName.toLowerCase()}/password-reset/verify
3. POST /api/v1/${appName.toLowerCase()}/password-reset/reset
4. POST /api/v1/${appName.toLowerCase()}/password-reset/status

Templates modifiables:
- dry/templates/email/password-reset.html
- dry/templates/email/password-reset-confirmation.html
## Frontend ready
1. Genere le client: \`npm run client:gen\`
2. Utilise \`VITE_API_BASE_URL\` ou \`REACT_APP_API_BASE_URL\`
3. Hooks disponibles: \`use${features[0] ? toPascal(features[0]) : 'Feature'}\`, \`useCreate...\`, \`useUpdate...\`

## Conventions DRY
1. Le champ \`label\` est genere automatiquement si absent
2. Le \`slug\` est cree depuis \`label\`
3. Champs techniques DRY: status, deletedAt, createdBy, updatedBy

## Tests
1. Lancer tous les tests: \`npm run test\`
2. Smoke test HTTP: \`npm run test:smoke\`

## Signature Backend
Ce backend est signe **Cyberfusion** (Server GOLD).
Email: servergold2012@gmail.com
Tel: +242068457521
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
    console.log('[readme] aucune app detectee');
    return;
  }

  apps.forEach((appName) => {
    const features = getFeatures(appName);
    const schemas = loadSchemas(appName);
    const content = buildReadme(appName, features, schemas);
    const outPath = path.join(DRY_APP, appName, 'README.md');
    fs.writeFileSync(outPath, content, 'utf8');
    console.log('[readme] ok', appName);
  });
};

main();


