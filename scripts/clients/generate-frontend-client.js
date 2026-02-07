#!/usr/bin/env node

/**
 * Génère un client frontend (Angular / React / React Native)
 * basé sur les routes DRY (/api/v1/<app>/<feature>)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Ajout des couleurs et fonctions d'affichage professionnelles
const color = (code, text) => `\x1b[${code}m${text}\x1b[0m`;
const bg = (code, text) => `\x1b[${code}m${text}\x1b[0m`;

const title = bg('46;97', ' 🚀 DRY FRONTEND CLIENT GENERATOR ');
const info = color('96', 'ℹ️  INFO');
const success = color('42;97', ' SUCCÈS ');
const warning = color('43;97', ' ATTENTION ');

const renderBox = (content, width = 50) => {
  const lines = content.split('\n');
  const maxLength = Math.max(width, ...lines.map(l => l.length));
  const border = '─'.repeat(maxLength + 4);
  
  console.log(color('96', `╭${border}╮`));
  lines.forEach(line => {
    const padded = line.padEnd(maxLength, ' ');
    console.log(color('96', `│  ${padded}  │`));
  });
  console.log(color('96', `╰${border}╯`));
};

const renderTable = (rows, header) => {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) =>
    cells
      .map((c, i) => String(c).padEnd(widths[i], ' '))
      .join(' │ ');
  
  const separator = widths.map((w) => '─'.repeat(w)).join('─┼─');
  const headerLine = widths.map((w) => '═'.repeat(w)).join('═╪═');
  
  console.log(color('96', `┌─${separator}─┐`));
  console.log(color('96', `│ ${line(header)} │`));
  console.log(color('96', `╞═${headerLine}═╡`));
  rows.forEach((r) => console.log(`│ ${line(r)} │`));
  console.log(color('96', `└─${separator}─┘`));
};

const ROOT = path.join(__dirname, '..', '..');
const DRY_APP = path.join(ROOT, 'dryApp');
const OUT = path.join(ROOT, 'generated', 'clients');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (q) => new Promise((resolve) => rl.question(q, resolve));

const writeFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const getApps = () => {
  console.log(`[debug] Recherche dans: ${DRY_APP}`);
  if (!fs.existsSync(DRY_APP)) {
    console.log(`[debug] Dossier n'existe pas: ${DRY_APP}`);
    return [];
  }
  const apps = fs.readdirSync(DRY_APP).filter((a) => !a.startsWith('.'));
  console.log(`[debug] Apps trouvées: ${apps.join(', ')}`);
  return apps;
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
  if (type === 'date') return 'string';
  if (type === 'array') {
    const it = desc?.items?.[0];
    return `${tsTypeFromJoi(it)}[]`;
  }
  if (type === 'object') return 'Record<string, any>';
  return 'any';
};

const buildTypesFromSchemas = (schemas) => {
  if (!schemas) return '';
  const parts = [];
  Object.keys(schemas).forEach((model) => {
    const create = schemas[model]?.create?.describe ? schemas[model].create.describe() : null;
    const update = schemas[model]?.update?.describe ? schemas[model].update.describe() : null;

    if (create?.keys) {
      parts.push(`export interface ${model}Create {`);
      Object.entries(create.keys).forEach(([k, v]) => {
        const optional = v?.flags?.presence === 'optional';
        parts.push(`  ${k}${optional ? '?' : ''}: ${tsTypeFromJoi(v)};`);
      });
      parts.push('}\n');
    }

    if (update?.keys) {
      parts.push(`export interface ${model}Update {`);
      Object.entries(update.keys).forEach(([k, v]) => {
        parts.push(`  ${k}?: ${tsTypeFromJoi(v)};`);
      });
      parts.push('}\n');
    }
  });

  return parts.join('\n');
};

const buildConfig = (appName, features) => {
  const baseUrl = 'http://localhost:5000';
  const appKey = appName.toLowerCase();
  const routes = {};
  features.forEach((f) => {
    routes[f] = {
      list: `/api/v1/${appKey}/${f}`,
      create: `/api/v1/${appKey}/${f}`,
      get: `/api/v1/${appKey}/${f}/:id`,
      update: `/api/v1/${appKey}/${f}/:id`,
      remove: `/api/v1/${appKey}/${f}/:id`,
    };
  });
  return { baseUrl, app: appName, routes };
};

const reactClient = (config) => {
  return `// Client React / React Native - DRY\n// Utilise VITE_API_BASE_URL / REACT_APP_API_BASE_URL / EXPO_PUBLIC_API_BASE_URL si present\nconst API_BASE_URL =\n  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||\n  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) ||\n  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL) ||\n  '${config.baseUrl}';\n\nconst withToken = (token) =>\n  token ? { Authorization: \`Bearer \${token}\` } : {};\n\nconst request = async (method, url, body, token) => {\n  const res = await fetch(\`\${API_BASE_URL}\${url}\`, {\n    method,\n    headers: {\n      'Content-Type': 'application/json',\n      ...withToken(token),\n    },\n    body: body ? JSON.stringify(body) : undefined,\n  });\n  return res.json();\n};\n\nexport const api = {\n  ${Object.keys(config.routes)
    .map(
      (f) => `\n  ${f}: {\n    list: (token) => request('GET', '${config.routes[f].list}', null, token),\n    getAll: (token) => request('GET', '${config.routes[f].list}', null, token),\n    create: (data, token) => request('POST', '${config.routes[f].create}', data, token),\n    get: (id, token) => request('GET', '${config.routes[f].get}'.replace(':id', id), null, token),\n    getById: (id, token) => request('GET', '${config.routes[f].get}'.replace(':id', id), null, token),\n    update: (id, data, token) => request('PUT', '${config.routes[f].update}'.replace(':id', id), data, token),\n    remove: (id, token) => request('DELETE', '${config.routes[f].remove}'.replace(':id', id), null, token),\n  }`
    )
    .join(',')}\n};\n`;
};

const reactHooks = (config) => {
  const hooks = Object.keys(config.routes).map((f) => {
    const hookName = `use${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    const hookGet = `use${f.charAt(0).toUpperCase()}${f.slice(1)}ById`;
    const hookCreate = `useCreate${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    const hookUpdate = `useUpdate${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    const hookDelete = `useDelete${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    return `export const ${hookName} = (token) => {\n  const [data, setData] = useState([]);\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState(null);\n\n  const list = async () => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.list(token);\n      setData(res?.data || []);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const create = async (payload) => api.${f}.create(payload, token);\n  const get = async (id) => (api.${f}.getById ? api.${f}.getById(id, token) : api.${f}.get(id, token));\n  const update = async (id, payload) => api.${f}.update(id, payload, token);\n  const remove = async (id) => api.${f}.remove(id, token);\n\n  const getAll = list;\n\n  return { data, loading, error, list, getAll, create, get, update, remove };\n};\n\nexport const ${hookGet} = (token, id) => {\n  const [item, setItem] = useState(null);\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState(null);\n\n  const fetchOne = async () => {\n    setLoading(true);\n    try {\n      const res = await (api.${f}.getById ? api.${f}.getById(id, token) : api.${f}.get(id, token));\n      setItem(res?.data || null);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { item, loading, error, fetchOne };\n};\n\nexport const ${hookCreate} = (token) => {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState(null);\n\n  const create = async (payload) => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.create(payload, token);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { create, loading, error };\n};\n\nexport const ${hookUpdate} = (token) => {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState(null);\n\n  const update = async (id, payload) => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.update(id, payload, token);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { update, loading, error };\n};\n\nexport const ${hookDelete} = (token) => {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState(null);\n\n  const remove = async (id) => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.remove(id, token);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { remove, loading, error };\n};`;
  }).join('\n\n');

  return `// Hooks React prets a l'emploi\nimport { useState } from 'react';\nimport { api } from './apiClient';\n\n${hooks}\n`;
};

const reactHooksTs = (config) => {
  const hooks = Object.keys(config.routes).map((f) => {
    const hookName = `use${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    const hookGet = `use${f.charAt(0).toUpperCase()}${f.slice(1)}ById`;
    const hookCreate = `useCreate${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    const hookUpdate = `useUpdate${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    const hookDelete = `useDelete${f.charAt(0).toUpperCase()}${f.slice(1)}`;
    return `export const ${hookName} = (token?: string) => {\n  const [data, setData] = useState<any[]>([]);\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<any>(null);\n\n  const list = async () => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.list(token);\n      setData(res?.data || []);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  const create = async (payload: any) => api.${f}.create(payload, token);\n  const get = async (id: string) => (api.${f}.getById ? api.${f}.getById(id, token) : api.${f}.get(id, token));\n  const update = async (id: string, payload: any) => api.${f}.update(id, payload, token);\n  const remove = async (id: string) => api.${f}.remove(id, token);\n\n  const getAll = list;\n\n  return { data, loading, error, list, getAll, create, get, update, remove };\n};\n\nexport const ${hookGet} = (token: string | undefined, id: string) => {\n  const [item, setItem] = useState<any>(null);\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<any>(null);\n\n  const fetchOne = async () => {\n    setLoading(true);\n    try {\n      const res = await (api.${f}.getById ? api.${f}.getById(id, token) : api.${f}.get(id, token));\n      setItem(res?.data || null);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { item, loading, error, fetchOne };\n};\n\nexport const ${hookCreate} = (token?: string) => {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<any>(null);\n\n  const create = async (payload: any) => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.create(payload, token);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { create, loading, error };\n};\n\nexport const ${hookUpdate} = (token?: string) => {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<any>(null);\n\n  const update = async (id: string, payload: any) => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.update(id, payload, token);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { update, loading, error };\n};\n\nexport const ${hookDelete} = (token?: string) => {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<any>(null);\n\n  const remove = async (id: string) => {\n    setLoading(true);\n    try {\n      const res = await api.${f}.remove(id, token);\n      setError(null);\n      return res;\n    } catch (e) {\n      setError(e);\n      throw e;\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { remove, loading, error };\n};`;
  }).join('\n\n');

  return `// Hooks React TypeScript + types\nimport { useState } from 'react';\nimport { api } from './apiClient';\nimport type * as Types from './types';\n\n${hooks}\n`;
};

const angularClient = (config) => {
  return `// Client Angular - DRY\nimport { Injectable } from '@angular/core';\nimport { HttpClient, HttpHeaders } from '@angular/common/http';\n\n@Injectable({ providedIn: 'root' })\nexport class ApiService {\n  private baseUrl =\n    (typeof (globalThis as any) !== 'undefined' && (globalThis as any).API_BASE_URL) ||\n    '${config.baseUrl}';\n\n  constructor(private http: HttpClient) {}\n\n  private authHeaders(token?: string) {\n    return token\n      ? { headers: new HttpHeaders({ Authorization: \`Bearer \${token}\` }) }\n      : {};\n  }\n\n  ${Object.keys(config.routes)
    .map(
      (f) => `\n  ${f}List(token?: string) {\n    return this.http.get(\`\${this.baseUrl}${config.routes[f].list}\`, this.authHeaders(token));\n  }\n  ${f}Create(data: any, token?: string) {\n    return this.http.post(\`\${this.baseUrl}${config.routes[f].create}\`, data, this.authHeaders(token));\n  }\n  ${f}Get(id: string, token?: string) {\n    return this.http.get(\`\${this.baseUrl}${config.routes[f].get}\`.replace(':id', id), this.authHeaders(token));\n  }\n  ${f}Update(id: string, data: any, token?: string) {\n    return this.http.put(\`\${this.baseUrl}${config.routes[f].update}\`.replace(':id', id), data, this.authHeaders(token));\n  }\n  ${f}Remove(id: string, token?: string) {\n    return this.http.delete(\`\${this.baseUrl}${config.routes[f].remove}\`.replace(':id', id), this.authHeaders(token));\n  }`
    )
    .join('\n')}\n}\n`;
};

const main = async () => {
  console.log('');
  console.log(title);
  console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', '│              🎨 FRONTEND CLIENT WIZARD           │'));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  console.log(color('96', '─────────────────────────────────────────────────────'));
  
  console.log(`${info} 📂 Dossier des applications: ${color('92', DRY_APP)}`);
  console.log(`${info} 📁 Dossier de sortie: ${color('92', OUT)}`);
  console.log(color('96', '─────────────────────────────────────────────────────'));

  const apps = getApps();
  if (!apps.length) {
    renderBox(`${warning} 🚫 Aucune application trouvée\n\nVérifiez que:\n• Les applications sont dans ${DRY_APP}\n• Chaque application a un dossier 'features'`);
    process.exit(0);
  }

  // Afficher les applications dans un tableau
  const appRows = apps.map(app => {
    const appPath = path.join(DRY_APP, app);
    const featuresPath = path.join(appPath, 'features');
    const hasFeatures = fs.existsSync(featuresPath);
    const features = hasFeatures ? getFeatures(app) : [];
    
    return [
      `📱 ${app}`,
      color('92', hasFeatures ? '✅' : '⚠️'),
      `${features.length} features`,
      hasFeatures ? color('92', 'DISPONIBLE') : color('93', 'INCOMPLET')
    ];
  });

  console.log(color('96', '\n╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', '│                 📱 APPLICATIONS TROUVÉES             │'));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  renderTable(appRows, ['Application', 'Features', 'Count', 'Statut']);
  console.log(color('96', '─────────────────────────────────────────────────────'));

  console.log('\n' + color('96', '─────────────────────────────────────────────────────'));
  console.log(`${info} 📋 Choisissez une application à générer:`);
  console.log(color('96', '─────────────────────────────────────────────────────'));

  apps.forEach((app, index) => {
    const features = getFeatures(app);
    console.log(`${color('93', String(index + 1))}) 📱 ${color('96', app)} ${color('90', `(${features.length} features)`)}`);
  });

  const appChoice = await question('\n🎯 Entrez le numéro de l\'application: ');
  const appIndex = parseInt(appChoice, 10) - 1;
  
  if (appIndex < 0 || appIndex >= apps.length) {
    renderBox(`${warning} ❌ Choix invalide: ${appChoice}`);
    process.exit(1);
  }

  const appName = apps[appIndex];
  const features = getFeatures(appName);
  
  if (!features.length) {
    renderBox(`${warning} ⚠️  L'application "${appName}" n'a pas de features\n\nVérifiez que le dossier features existe dans:\n${path.join(DRY_APP, appName, 'features')}`);
    process.exit(1);
  }

  console.log('');
  console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', `│               🛠️  CONFIGURATION: ${appName}               │`));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  console.log(color('96', '─────────────────────────────────────────────────────'));
  console.log(`${info} 📱 Application: ${color('92', appName)}`);
  console.log(`${info} ⚙️  Features: ${color('92', features.join(', '))}`);
  console.log(color('96', '─────────────────────────────────────────────────────'));

  const framework = await question('🎨 Framework (react | react-native | angular): ');
  if (!['react', 'react-native', 'angular'].includes(framework)) {
    renderBox(`${warning} ❌ Framework non supporté: ${framework}\nFrameworks supportés: react, react-native, angular`);
    process.exit(1);
  }

  const config = buildConfig(appName, features);
  const schemas = loadSchemas(appName);
  const typesContent = buildTypesFromSchemas(schemas);

  const outDir = path.join(OUT, appName, framework);
  
  console.log('\n🚀 Génération du client frontend...\n');
  
  // Création des fichiers avec progression
  const steps = [
    { file: 'api.config.json', desc: 'Configuration API' },
    { file: framework === 'angular' ? 'api.service.ts' : 'apiClient.js', desc: 'Client API' },
    { file: 'hooks.js', desc: 'Hooks React' },
    { file: 'types.ts', desc: 'Types TypeScript' }
  ];

  steps.forEach((step, index) => {
    const percentage = Math.round(((index + 1) / steps.length) * 100);
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    console.log(`${step.desc} [${color('92', bar)}] ${percentage}% (${index + 1}/${steps.length})`);
    
    if (step.file === 'api.config.json') {
      writeFile(path.join(outDir, step.file), JSON.stringify(config, null, 2));
    } else if (step.file === 'api.service.ts') {
      writeFile(path.join(outDir, step.file), angularClient(config));
    } else if (step.file === 'apiClient.js') {
      writeFile(path.join(outDir, step.file), reactClient(config));
    } else if (step.file === 'hooks.js') {
      writeFile(path.join(outDir, step.file), reactHooks(config));
    } else if (step.file === 'types.ts') {
      writeFile(path.join(outDir, step.file), typesContent);
      if (framework === 'react') {
        writeFile(path.join(outDir, 'hooks.ts'), reactHooksTs(config));
      }
    }
  });

  console.log('\n');

  // Affichage des fichiers générés
  const generatedFiles = steps.map(s => path.join(outDir, s.file));
  
  renderBox(
    `📁 FICHIERS GÉNÉRÉS (${generatedFiles.length})\n\n` +
    generatedFiles.map(f => `✅ ${path.relative(process.cwd(), f)}`).join('\n')
  );

  console.log('\n' + color('96', '─────────────────────────────────────────────────────'));
  console.log(`${success} 🎉 CLIENT FRONTEND GÉNÉRÉ AVEC SUCCÈS!`);
  console.log(`${info} 📂 Dossier: ${color('92', outDir)}`);
  console.log(`${info} 🎨 Framework: ${color('92', framework)}`);
  console.log(`${info} 📱 Application: ${color('92', appName)}`);
  console.log(color('96', '─────────────────────────────────────────────────────'));

  console.log(`\n${info} 📝 Prochaines étapes:`);
  console.log(`   • cd ${path.relative(process.cwd(), outDir)}`);
  console.log(`   • npm install (si nécessaire)`);
  console.log(`   • Importer les fichiers dans votre projet`);

  console.log('\n' + color('96', '─────────────────────────────────────────────────────'));
  console.log(color('96', '│                   🌟 BON DÉVELOPPEMENT!             │'));
  console.log(color('96', '─────────────────────────────────────────────────────'));

  rl.close();
};

main();








