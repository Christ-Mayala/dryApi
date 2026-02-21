#!/usr/bin/env node

/**
 * Génère un client frontend NATIVE ANGULAR pour l'architecture DRY
 * S'intègre directement avec @dry/sdk/services/base-api.service
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI Colors
const C = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  CYAN: '\x1b[36m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
};

const ROOT = path.join(__dirname, '..', '..');
const DRY_APP = path.join(ROOT, 'dryApp'); // Backend apps source
const OUT = path.join(ROOT, 'generated', 'clients');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (q) => new Promise((resolve) => rl.question(`${C.CYAN}?${C.RESET} ${q}`, resolve));

const writeFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
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
    const appKey = appName.charAt(0).toLowerCase() + appName.slice(1);
    const mod = require(schemasPath);
    return mod[`${appKey}Schemas`] || null;
  } catch (e) {
    return null;
  }
};

const tsTypeFromJoi = (desc) => {
  const type = desc?.type || 'any';
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'date') return 'Date | string';
  if (type === 'array') {
    const it = desc?.items?.[0];
    return `${tsTypeFromJoi(it)}[]`;
  }
  if (type === 'object') return 'Record<string, any>';
  return 'any';
};

const buildModels = (schemas) => {
  if (!schemas) return [];
  const models = [];
  
  Object.keys(schemas).forEach((model) => {
    const create = schemas[model]?.create?.describe ? schemas[model].create.describe() : null;
    
    let content = `export interface ${model} {\n`;
    content += `  _id: string;\n`;
    content += `  createdAt?: string;\n`;
    content += `  updatedAt?: string;\n`;
    
    if (create?.keys) {
      Object.entries(create.keys).forEach(([k, v]) => {
        content += `  ${k}: ${tsTypeFromJoi(v)};\n`;
      });
    }
    content += `}\n`;
    
    models.push({ name: model, content });
  });

  return models;
};

const generateNativeClient = (appName, features, models) => {
  const files = [];
  const lowerApp = appName.toLowerCase();

  // 1. Models
  models.forEach(m => {
    files.push({
      path: `models/${m.name.toLowerCase()}.model.ts`,
      content: m.content
    });
  });
  
  const modelsIndex = models.map(m => `export * from './${m.name.toLowerCase()}.model';`).join('\n');
  files.push({ path: 'models/index.ts', content: modelsIndex });

  // 2. Services
  features.forEach(feature => {
    const PascalFeature = feature.charAt(0).toUpperCase() + feature.slice(1);
    const modelName = PascalFeature; // Assumption
    const hasModel = models.some(m => m.name === modelName);
    const ModelType = hasModel ? modelName : 'any';
    const importModel = hasModel ? `import { ${ModelType} } from '../models/${ModelType.toLowerCase()}.model';` : '';

    const content = `import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';
${importModel}

@Injectable({ providedIn: 'root' })
export class ${PascalFeature}Service extends BaseApiService<${ModelType}> {
  protected resourcePath = '/${feature}';

  // Override baseUrl to target the ${appName} app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\\/[^\\/]+$/, '');
    return \`\${rootApi}/${lowerApp}\${this.resourcePath}\`;
  }
}
`;
    files.push({ path: `services/${feature}.service.ts`, content });
  });

  // 3. Barrel file
  const serviceExports = features.map(f => `export * from './services/${f}.service';`).join('\n');
  files.push({ 
    path: 'index.ts', 
    content: `export * from './models';\n${serviceExports}\n` 
  });

  return files;
};

const generateInstallScript = (appName) => {
  return `
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('📦 Installateur DRY NATIVE pour ${appName}');
console.log('Ce script installe le client directement dans votre architecture @dry/sdk ou features.');

const defaultPath = path.resolve(__dirname, '../../../../dryApp/src/app/features/${appName.toLowerCase()}');

rl.question(\`Chemin d'installation (par defaut: \${defaultPath}) : \`, (targetDir) => {
  const dest = targetDir.trim() || defaultPath;

  if (!fs.existsSync(dest)) {
    console.log(\`Création du dossier: \${dest}\`);
    fs.mkdirSync(dest, { recursive: true });
  }

  const src = __dirname;
  
  // Copy models
  const destModels = path.join(dest, 'models');
  if (!fs.existsSync(destModels)) fs.mkdirSync(destModels, { recursive: true });
  fs.readdirSync(path.join(src, 'models')).forEach(f => {
    fs.copyFileSync(path.join(src, 'models', f), path.join(destModels, f));
  });

  // Copy services
  const destServices = path.join(dest, 'services');
  if (!fs.existsSync(destServices)) fs.mkdirSync(destServices, { recursive: true });
  fs.readdirSync(path.join(src, 'services')).forEach(f => {
    fs.copyFileSync(path.join(src, 'services', f), path.join(destServices, f));
  });

  // Copy index
  fs.copyFileSync(path.join(src, 'index.ts'), path.join(dest, 'index.ts'));

  console.log('\\n🎉 Installation terminée !');
  console.log(\`✅ Client installé dans : \${dest}\`);
  console.log('👉 Vous pouvez maintenant importer les services directement.');
  rl.close();
});
`;
};

const main = async () => {
  console.log(`\n${C.BRIGHT}${C.CYAN}🚀 DRY NATIVE CLIENT GENERATOR${C.RESET}\n`);

  const apps = getApps();
  let appName = process.argv[2];

  if (!appName) {
    // Interactive selection logic omitted for brevity as we know the target is SkillForge
    console.log('Usage: node generate-frontend-client.js <AppName>');
    process.exit(1);
  }

  // Case insensitive match
  const found = apps.find(a => a.toLowerCase() === appName.toLowerCase());
  if (!found) {
    console.log(`${C.RED}❌ Application ${appName} introuvable.${C.RESET}`);
    process.exit(1);
  }
  appName = found;

  const features = getFeatures(appName);
  const schemas = loadSchemas(appName);
  const models = buildModels(schemas);

  const outDir = path.join(OUT, appName, 'angular-native');
  
  console.log(`Génération pour ${C.GREEN}${appName}${C.RESET} (${features.length} features)...`);
  
  const files = generateNativeClient(appName, features, models);
  
  files.forEach(f => {
    writeFile(path.join(outDir, f.path), f.content);
    console.log(`✅ ${f.path}`);
  });

  writeFile(path.join(outDir, 'install.js'), generateInstallScript(appName));
  writeFile(path.join(outDir, 'README.md'), `# Client Native ${appName}\n\nClient optimisé pour l'architecture DRY Angular.\n\nRun \`node install.js\` to install.`);

  console.log(`\n${C.GREEN}Succès !${C.RESET} Client généré dans: ${outDir}`);
  console.log(`👉 cd ${outDir} && node install.js`);
  process.exit(0);
};

main();
