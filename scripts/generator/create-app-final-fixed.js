
/**
 * GENERATEUR D'APPLICATION DRY - PRO EDITION
 * Objectif: creer des applications professionnelles, fonctionnelles de base,
 * et parfaitement compatibles avec ton systeme DRY.
 *
 * Points cles:
 * - Multi-tenant: models dynamiques via req.getModel()
 * - Schemas Mongoose exportes (pas mongoose.model)
 * - Imports DRY corrects et uniformes
 * - Validation Joi centralisee (dry/utils/validation/validation.util)
 * - QueryBuilder + cache + audit + swagger integres
 * - Securite professionnelle activee par defaut
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const color = (code, text) => `\x1b[${code}m${text}\x1b[0m`;
const bg = (code, text) => `\x1b[${code}m${text}\x1b[0m`;

const title = bg('46;97', ' 🚀 DRY APP GENERATOR ');
const ok = color('92', '✅ SUCCÈS');
const ko = color('91', '❌ ERREUR');
const warn = color('93', '⚠️  ATTENTION');
const info = color('96', 'ℹ️  INFO');
const success = color('42;97', ' SUCCÈS ');
const error = color('41;97', ' ERREUR ');
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

const renderProgress = (current, total, label = '') => {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((percentage / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  console.log(`${label} [${color('92', bar)}] ${percentage}% (${current}/${total})`);
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

const log = (message, type = 'info') => {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  const colors = {
    info: '96',
    success: '92',
    warning: '93',
    error: '91'
  };
  console.log(`${color(colors[type], icons[type] + ' ' + message)}`);
};

// Templates professionnels (champs au format "nom:Type")
const PROFESSIONAL_TEMPLATES = {
  restaurant: {
    name: 'RestoPro',
    desc: 'Systeme de gestion de restaurant complet',
    features: [
      { name: 'menus', model: 'Menu', fields: ['nom:String', 'categorie:String', 'prix:Number', 'description:String', 'disponible:Boolean'] },
      { name: 'commandes', model: 'Commande', fields: ['numeroTable:Number', 'items:Array', 'total:Number', 'statut:String', 'dateCommande:Date'] },
      { name: 'tables', model: 'Table', fields: ['numero:Number', 'capacite:Number', 'zone:String', 'statut:String'] },
      { name: 'clients', model: 'Client', fields: ['nom:String', 'telephone:String', 'email:String', 'pointsFidelite:Number'] },
      { name: 'reservations', model: 'Reservation', fields: ['nomClient:String', 'telephone:String', 'nombrePersonnes:Number', 'dateReservation:Date', 'heureReservation:String'] },
    ],
  },
  fitness: {
    name: 'FitnessPro',
    desc: 'Application de gestion de salle de sport',
    features: [
      { name: 'membres', model: 'Membre', fields: ['nom:String', 'prenom:String', 'email:String', 'telephone:String', 'dateNaissance:Date', 'objectif:String'] },
      { name: 'abonnements', model: 'Abonnement', fields: ['membreId:String', 'type:String', 'dateDebut:Date', 'dateFin:Date', 'prix:Number', 'statut:String'] },
      { name: 'seances', model: 'Seance', fields: ['membreId:String', 'coachId:String', 'date:Date', 'duree:Number', 'type:String'] },
      { name: 'coachs', model: 'Coach', fields: ['nom:String', 'prenom:String', 'specialite:String', 'email:String', 'telephone:String'] },
      { name: 'equipements', model: 'Equipement', fields: ['nom:String', 'type:String', 'etat:String', 'dateAchat:Date'] },
    ],
  },
  ecommerce: {
    name: 'ShopPro',
    desc: 'Application e-commerce moderne',
    features: [
      { name: 'produits', model: 'Produit', fields: ['nom:String', 'description:String', 'prix:Number', 'categorie:String', 'stock:Number'] },
      { name: 'categories', model: 'Categorie', fields: ['nom:String', 'description:String', 'parent:String'] },
      { name: 'commandes', model: 'Commande', fields: ['clientId:String', 'produits:Array', 'total:Number', 'statut:String'] },
      { name: 'clients', model: 'Client', fields: ['nom:String', 'email:String', 'telephone:String', 'adresse:String'] },
    ],
  },
  blog: {
    name: 'BlogPro',
    desc: 'Application de blog professionnelle',
    features: [
      { name: 'articles', model: 'Article', fields: ['titre:String', 'contenu:String', 'auteur:String', 'categorie:String', 'tags:Array'] },
      { name: 'categories', model: 'Categorie', fields: ['nom:String', 'description:String', 'slug:String'] },
      { name: 'commentaires', model: 'Commentaire', fields: ['articleId:String', 'auteur:String', 'contenu:String', 'email:String'] },
    ],
  },
  immobilier: {
    name: 'ImmoPro',
    desc: 'Gestion immobiliere avancee',
    features: [
      { name: 'biens', model: 'Bien', fields: ['titre:String', 'description:String', 'prix:Number', 'type:String', 'surface:Number', 'chambres:Number', 'sallesDeBain:Number', 'adresse:String', 'ville:String', 'codePostal:String', 'disponible:Boolean'] },
      { name: 'visites', model: 'Visite', fields: ['bienId:String', 'clientId:String', 'dateVisite:Date', 'statut:String', 'commentaire:String'] },
      { name: 'clients', model: 'Client', fields: ['nom:String', 'email:String', 'telephone:String', 'budget:Number', 'recherche:String'] },
    ],
  },
  sante: {
    name: 'HealthPro',
    desc: 'Application de gestion sante',
    features: [
      { name: 'patients', model: 'Patient', fields: ['nom:String', 'prenom:String', 'email:String', 'telephone:String', 'dateNaissance:Date', 'sexe:String', 'groupeSanguin:String'] },
      { name: 'rendezvous', model: 'RendezVous', fields: ['patientId:String', 'medecinId:String', 'date:Date', 'motif:String', 'statut:String'] },
      { name: 'medecins', model: 'Medecin', fields: ['nom:String', 'prenom:String', 'specialite:String', 'email:String', 'telephone:String'] },
    ],
  },
  education: {
    name: 'EduPro',
    desc: 'Plateforme education et formation',
    features: [
      { name: 'etudiants', model: 'Etudiant', fields: ['nom:String', 'prenom:String', 'email:String', 'telephone:String', 'niveau:String'] },
      { name: 'cours', model: 'Cours', fields: ['titre:String', 'description:String', 'niveau:String', 'duree:Number', 'prix:Number'] },
      { name: 'inscriptions', model: 'Inscription', fields: ['etudiantId:String', 'coursId:String', 'dateInscription:Date', 'statut:String'] },
    ],
  },
};

const toPascal = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const toCamel = (value) => value.charAt(0).toLowerCase() + value.slice(1);
const normalizeSpaces = (value) => value.replace(/\s+/g, ' ').trim();
const normalizeKey = (value) => value.replace(/[^a-zA-Z0-9]/g, '').trim();
const safeAppName = (value) => {
  const compact = normalizeKey(value);
  return compact || normalizeKey(normalizeSpaces(value));
};

const parseField = (field) => {
  const raw = field.trim();
  if (!raw) return null;
  const parts = raw.split(':').map((p) => p.trim());
  return { name: parts[0], type: parts[1] || 'String' };
};

const toSwaggerType = (type) => {
  switch (type) {
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'string';
    case 'Array':
      return 'array';
    case 'ObjectId':
      return 'string';
    default:
      return 'string';
  }
};

const toSwaggerExample = (name, type) => {
  const lower = name.toLowerCase();
  if (lower.includes('email')) return 'demo@example.com';
  if (lower.includes('tel')) return '+22501020304';
  if (type === 'Number') return 100;
  if (type === 'Boolean') return true;
  if (type === 'Date') return '2026-01-01T12:00:00.000Z';
  if (type === 'Array') return [];
  return `exemple_${name}`;
};

const buildSwaggerSchema = (fields) => {
  const parsed = (fields || []).map(parseField).filter(Boolean);
  const props = parsed.map(({ name, type }) => {
    const swaggerType = toSwaggerType(type);
    const example = toSwaggerExample(name, type);
    return ` *         ${name}:\n *           type: ${swaggerType}\n *           example: ${JSON.stringify(example)}`;
  });
  if (!parsed.some((f) => f.name.toLowerCase() === 'label')) {
    props.push(` *         label:\n *           type: string\n *           example: "exemple_label"`);
  }
  // Champs automatiques DRY
  props.push(` *         status:\n *           type: string\n *           enum: [active, inactive, deleted, banned]\n *           example: active`);
  props.push(` *         createdAt:\n *           type: string\n *           format: date-time`);
  props.push(` *         updatedAt:\n *           type: string\n *           format: date-time`);

  return props.join('\n');
};

const buildTestPayload = (fields) => {
  const parsed = (fields || []).map(parseField).filter(Boolean);
  const lines = [];
  let hasLabel = false;

  parsed.forEach(({ name, type }) => {
    const lower = name.toLowerCase();
    if (lower === 'label') hasLabel = true;

    let value = `'exemple_${name}'`;
    if (lower.includes('email')) value = '`demo+${Date.now()}@example.com`';
    else if (lower.includes('tel')) value = `'+22501020304'`;
    else if (type === 'Number') value = '100';
    else if (type === 'Boolean') value = 'true';
    else if (type === 'Date') value = '`2026-01-01T12:00:00.000Z`';
    else if (type === 'Array') value = '[]';

    lines.push(`  ${name}: ${value}`);
  });

  if (!hasLabel) {
    lines.push("  label: `Exemple label ${Date.now()}`");
  }

  return `{\n${lines.join(',\n')}\n}`;
};

const buildReadmePayload = (fields) => {
  const parsed = (fields || []).map(parseField).filter(Boolean);
  const obj = {};
  let hasLabel = false;

  parsed.forEach(({ name, type }) => {
    const lower = name.toLowerCase();
    if (lower === 'label') hasLabel = true;
    if (lower.includes('email')) obj[name] = 'demo@example.com';
    else if (lower.includes('tel')) obj[name] = '+22501020304';
    else if (type === 'Number') obj[name] = 100;
    else if (type === 'Boolean') obj[name] = true;
    else if (type === 'Date') obj[name] = '2026-01-01T12:00:00.000Z';
    else if (type === 'Array') obj[name] = [];
    else obj[name] = `exemple_${name}`;
  });

  if (!hasLabel) obj.label = 'exemple_label';
  return JSON.stringify(obj, null, 2);
};

const createFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  log(`Cree: ${path.relative(process.cwd(), filePath)}`, 'success');
};

const templates = {
  model: (modelName, fields) => {
    const parsedFields = fields
      .map(parseField)
      .filter(Boolean)
      .map(({ name, type }) => {
        const base = {
          String: 'String',
          Number: 'Number',
          Boolean: 'Boolean',
          Date: 'Date',
          Array: 'Array',
          ObjectId: 'mongoose.Schema.Types.ObjectId',
        };

        const mongooseType = base[type] || 'String';
        const parts = [`type: ${mongooseType}`];

        if (type === 'Boolean') {
          parts.push('default: false');
        } else if (type === 'Array') {
          parts.push('default: []');
        } else {
          parts.push('required: true');
        }

        if (mongooseType === 'String') {
          parts.push('trim: true');
        }
        if (name.toLowerCase().includes('email')) {
          parts.push('lowercase: true');
          parts.push('unique: true');
        }
        if (name.toLowerCase().includes('password')) {
          parts.push('minlength: 6');
          parts.push('select: false');
        }

        return { name, line: `  ${name}: { ${parts.join(', ')} }` };
      });

    const hasLabel = parsedFields.some((f) => f.name.toLowerCase() === 'label');
    const schemaLines = parsedFields.map((f) => f.line);
    if (!hasLabel) {
      // Label explicite (utilise pour le slug DRY)
      schemaLines.push(`  label: { type: String, trim: true }`);
    }

    const schemaFields = schemaLines.join(',\n');

    return `const mongoose = require('mongoose');\n\nconst ${modelName}Schema = new mongoose.Schema({\n${schemaFields}\n}, {\n  timestamps: true\n});\n\n// Indexes pour performance et requetes frequentes\n${modelName}Schema.index({ createdAt: -1 });\n${modelName}Schema.index({ status: 1 });\n\n// Note: DRY ajoute automatiquement slug/status/deletedAt/createdBy/updatedBy via le plugin global\n\nmodule.exports = ${modelName}Schema;\n`;
  },

  controller: (featureName, modelName, action) => {
    const base = `const asyncHandler = require('express-async-handler');\nconst sendResponse = require('../../../../../dry/utils/http/response');\nconst ${modelName}Schema = require('../model/${featureName}.schema');\n`;

    const actions = {
      getAll: `${base}\n// GET ALL - retourne une liste paginee via queryBuilder\nmodule.exports = asyncHandler(async (req, res) => {\n  // res.advancedResults est rempli par le middleware queryBuilder\n  const { data, pagination } = res.advancedResults || { data: [], pagination: null };\n  return sendResponse(res, data, 'Liste recuperee', true, pagination || undefined);\n});\n`,

      create: `${base}\n// CREATE - cree un element\nmodule.exports = asyncHandler(async (req, res) => {\n  const Model = req.getModel('${modelName}', ${modelName}Schema);\n  const payload = { ...req.body };\n  if (req.user?.id) payload.createdBy = req.user.id;\n  const item = await Model.create(payload);\n  return sendResponse(res, item, '${modelName} cree');\n});\n`,

      getById: `${base}\n// GET BY ID - recupere un element par ID\nmodule.exports = asyncHandler(async (req, res) => {\n  const Model = req.getModel('${modelName}', ${modelName}Schema);\n  const item = await Model.findById(req.params.id);\n  if (!item) throw new Error('${modelName} introuvable');\n  return sendResponse(res, item, '${modelName} recupere');\n});\n`,

      update: `${base}\n// UPDATE - met a jour un element par ID\nmodule.exports = asyncHandler(async (req, res) => {\n  const Model = req.getModel('${modelName}', ${modelName}Schema);\n  const payload = { ...req.body };\n  if (req.user?.id) payload.updatedBy = req.user.id;\n  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });\n  if (!item) throw new Error('${modelName} introuvable');\n  return sendResponse(res, item, '${modelName} mis a jour');\n});\n`,

      delete: `${base}\n// DELETE - desactive un element (soft delete)\nmodule.exports = asyncHandler(async (req, res) => {\n  const Model = req.getModel('${modelName}', ${modelName}Schema);\n  const payload = { status: 'deleted' };\n  if (req.user?.id) payload.updatedBy = req.user.id;\n  const item = await Model.findByIdAndUpdate(req.params.id, payload, { new: true });\n  if (!item) throw new Error('${modelName} introuvable');\n  return sendResponse(res, item, '${modelName} supprime');\n});\n`,
    };

    return actions[action];
  },

  routes: (featureName, modelName, appName, options = {}, fields = []) => {
    const swaggerSchema = buildSwaggerSchema(fields);
    return `const express = require('express');\nconst router = express.Router();\n\nconst { protect, authorize } = require('../../../../../dry/middlewares/protection/auth.middleware');\nconst { validateId, validateQuery } = require('../../../../../dry/middlewares/validation/validation.middleware');\nconst { validate${appName}, ensureLabel } = require('../../../validation/middleware');\nconst { cache, invalidateCache } = require('../../../../../dry/middlewares/cache/cache.middleware');\nconst { withAudit } = require('../../../../../dry/middlewares/audit');\nconst queryBuilder = require('../../../../../dry/middlewares/query/queryBuilder');\nconst ${modelName}Schema = require('../model/${featureName}.schema');\n${options.ultraPro ? "// Mode Professionnel: securite globale geree par le DRY (security.middleware.js)\\n" : ''}\n\nconst create = require('../controller/${featureName}.create.controller');\nconst getAll = require('../controller/${featureName}.getAll.controller');\nconst getById = require('../controller/${featureName}.getById.controller');\nconst update = require('../controller/${featureName}.update.controller');\nconst remove = require('../controller/${featureName}.delete.controller');\n\n${options.ultraPro ? `// Mode Professionnel: securite globale activee dans le serveur\\n` : ''}\n\n// Injection du modele dynamique pour ce tenant (multi-tenant)\nconst setupModel = (req, res, next) => {\n  req.targetModel = req.getModel('${modelName}', ${modelName}Schema);\n  next();\n};\n\n// Query builder generique reutilisable (tri, pagination, filtres)\nconst dynamicQB = async (req, res, next) => await queryBuilder(req.targetModel)(req, res, next);\n\n// =========================\n// Routes publiques (lecture)\n// =========================\n/**\n * @swagger\n * /api/v1/${appName.toLowerCase()}/${featureName}:\n *   get:\n *     summary: Lister ${modelName}\n *     tags: [${appName}]\n *     parameters:\n *       - in: query\n *         name: page\n *         schema:\n *           type: integer\n *           default: 1\n *       - in: query\n *         name: limit\n *         schema:\n *           type: integer\n *           default: 10\n *     responses:\n *       200:\n *         description: Liste ${modelName}\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/SuccessResponse'\n *       400:\n *         description: Erreur\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/ErrorResponse'\n */\nrouter.get('/', setupModel, validateQuery.pagination, cache(300), dynamicQB, getAll);\n\n/**\n * @swagger\n * /api/v1/${appName.toLowerCase()}/${featureName}/{id}:\n *   get:\n *     summary: Recuperer ${modelName} par ID\n *     tags: [${appName}]\n *     parameters:\n *       - name: id\n *         in: path\n *         required: true\n *         schema:\n *           type: string\n *     responses:\n *       200:\n *         description: ${modelName} recupere\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/SuccessResponse'\n *       400:\n *         description: Erreur\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/ErrorResponse'\n */\nrouter.get('/:id', validateId, cache(600), getById);\n\n// ==============================================\n// Routes admin securisees (ecriture / modification)\n// ==============================================\n/**\n * @swagger\n * /api/v1/${appName.toLowerCase()}/${featureName}:\n *   post:\n *     summary: Creer ${modelName}\n *     tags: [${appName}]\n *     requestBody:\n *       required: true\n *       content:\n *         application/json:\n *           schema:\n *             type: object\n *             properties:\n${swaggerSchema}\n *     responses:\n *       200:\n *         description: ${modelName} cree\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/SuccessResponse'\n *       400:\n *         description: Erreur\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/ErrorResponse'\n */\nrouter.post(\n  '/',\n  protect,\n  authorize('admin'),\n  ensureLabel('${featureName}'),\n  validate${appName}.${featureName}.create,\n  withAudit('${featureName.toUpperCase()}_CREATE'),\n  invalidateCache(),\n  create\n);\n\n/**\n * @swagger\n * /api/v1/${appName.toLowerCase()}/${featureName}/{id}:\n *   put:\n *     summary: Mettre a jour ${modelName}\n *     tags: [${appName}]\n *     parameters:\n *       - name: id\n *         in: path\n *         required: true\n *         schema:\n *           type: string\n *     requestBody:\n *       required: true\n *       content:\n *         application/json:\n *           schema:\n *             type: object\n *             properties:\n${swaggerSchema}\n *     responses:\n *       200:\n *         description: ${modelName} mis a jour\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/SuccessResponse'\n *       400:\n *         description: Erreur\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/ErrorResponse'\n */\nrouter.put(\n  '/:id',\n  protect,\n  authorize('admin'),\n  validateId,\n  ensureLabel('${featureName}'),\n  validate${appName}.${featureName}.update,\n  withAudit('${featureName.toUpperCase()}_UPDATE'),\n  invalidateCache(),\n  update\n);\n\n/**\n * @swagger\n * /api/v1/${appName.toLowerCase()}/${featureName}/{id}:\n *   delete:\n *     summary: Supprimer ${modelName}\n *     tags: [${appName}]\n *     parameters:\n *       - name: id\n *         in: path\n *         required: true\n *         schema:\n *           type: string\n *     responses:\n *       200:\n *         description: ${modelName} supprime\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/SuccessResponse'\n *       400:\n *         description: Erreur\n *         content:\n *           application/json:\n *             schema:\n *               $ref: '#/components/schemas/ErrorResponse'\n */\nrouter.delete(\n  '/:id',\n  protect,\n  authorize('admin'),\n  validateId,\n  withAudit('${featureName.toUpperCase()}_DELETE'),\n  invalidateCache(),\n  remove\n);\n\nmodule.exports = router;\n`;
  },

  schemas: (appKey, features) => {
    let output = `const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const ${appKey}Schemas = {`;

    features.forEach(({ name, model, fields }) => {
      const parsed = (fields || []).map(parseField).filter(Boolean);
      const hasLabel = parsed.some((f) => f.name.toLowerCase() === 'label');
      const lines = parsed.map(({ name: fname, type }) => {
        const lower = fname.toLowerCase();
        let joi = 'Joi.string()';
        if (type === 'Number') joi = 'Joi.number()';
        if (type === 'Boolean') joi = 'Joi.boolean()';
        if (type === 'Date') joi = 'commonSchemas.date';
        if (type === 'Array') joi = 'Joi.array()';
        if (lower.includes('email')) joi = 'commonSchemas.email';
        if (lower.includes('password')) joi = 'commonSchemas.password';
        return `      ${fname}: ${joi}.required(),`;
      });

      if (!hasLabel) {
        lines.push(`      label: Joi.string().min(2).max(200).optional(),`);
      }

      const updateLines = lines.map((l) => l.replace('.required()', '.optional()'));

      output += `
  ${model}: {
    create: Joi.object({
${lines.join('\n')}
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
${updateLines.join('\n')}
      status: commonSchemas.status.optional()
    })
  },`;
    });

    output += `
};

module.exports = { ${appKey}Schemas };
`;
    return output;
  },

  validationMiddleware: (appName, appKey, features) => {
    let output = `const { validate } = require('../../../dry/utils/validation/validation.util');
const { ${appKey}Schemas } = require('./schemas');

// Mapping des champs significatifs pour generer un label si absent
const labelCandidates = {
`;

    features.forEach(({ name, fields }) => {
      const parsed = (fields || []).map(parseField).filter(Boolean);
      const keys = parsed.map((f) => f.name);
      const base = ['label', 'name', 'nom', 'title', 'titre', 'subject', 'email'];
      const all = [...base, ...keys].filter((v, i, a) => v && a.indexOf(v) === i);
      output += `  ${name}: ${JSON.stringify(all)},\n`;
    });

    output += `};

const ensureLabel = (featureKey) => (req, res, next) => {
  try {
    if (req.body && !req.body.label) {
      const keys = labelCandidates[featureKey] || [];
      for (const key of keys) {
        const val = req.body[key];
        if (typeof val === 'string' && val.trim()) {
          req.body.label = val.trim();
          break;
        }
      }
    }
    next();
  } catch (e) {
    next();
  }
};

const validate${appName} = {`;

    features.forEach(({ name, model }) => {
      output += `
  ${name}: {
    create: validate(${appKey}Schemas.${model}.create),
    update: validate(${appKey}Schemas.${model}.update)
  },`;
    });

    output += `
};

module.exports = { validate${appName}, ensureLabel };
`;
    return output;
  },
  seed: (appName, features) => {
    const blocks = features.map((f) => {
      const modelName = f.model;
      const featureName = f.name;
      const fields = (f.fields || []).map((v) => v.split(':')[0]).filter(Boolean);
      const hasLabel = fields.some((k) => k.toLowerCase() === 'label');

      const buildDoc = (index) => {
        const lines = [];
        fields.forEach((k) => {
          const key = k.trim();
          if (!key) return;
          const lower = key.toLowerCase();
          let value = `'exemple_${key}_' + index`;
          if (lower.includes('email')) value = '`demo+${Date.now()}@example.com`';
          else if (lower.includes('tel')) value = `'+22501020304'`;
          lines.push(`    ${key}: ${value}`);
        });
        if (!hasLabel) lines.push(`    label: \`Exemple ${featureName} \${index}\``);
        return `  {\n${lines.join(',\n')}\n  }`;
      };

      return `  // ${featureName}\n  const ${featureName}Schema = require('./features/${featureName}/model/${featureName}.schema');\n  const ${modelName} = getModel(appName, '${modelName}', ${featureName}Schema);\n  const ${featureName}Docs = [\n${[1, 2, 3].map((i) => buildDoc(i)).join(',\n')}\n  ];\n  const ${featureName}Created = await ${modelName}.insertMany(${featureName}Docs);\n  count += ${featureName}Created.length;\n  await logSeed({\n    appName,\n    feature: '${featureName}',\n    modelName: '${modelName}',\n    schemaPath: path.join(__dirname, 'features', '${featureName}', 'model', '${featureName}.schema.js'),\n    ids: ${featureName}Created.map((d) => d._id),\n  });\n`;
    });

    return `const path = require('path');\n\nmodule.exports = async ({ appName, getModel, logSeed }) => {\n  let count = 0;\n${blocks.join('\n')}\n  return { count };\n};\n`;
  },

  readme: (appName, features, options = {}) => {
    const endpoints = features.map((f) => `- /api/v1/${appName.toLowerCase()}/${f.name}`).join('\n');
    const perFeature = features
      .map((f) => {
        const payload = buildReadmePayload(f.fields || []);
        return `### ${f.name}\n- GET /api/v1/${appName.toLowerCase()}/${f.name}\n- POST /api/v1/${appName.toLowerCase()}/${f.name}\n- GET /api/v1/${appName.toLowerCase()}/${f.name}/:id\n- PUT /api/v1/${appName.toLowerCase()}/${f.name}/:id\n- DELETE /api/v1/${appName.toLowerCase()}/${f.name}/:id\n\nExemple payload:\n\`\`\`json\n${payload}\n\`\`\``;
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
3. Hooks disponibles: \`use${features[0]?.name ? toPascal(features[0].name) : 'Feature'}\`, \`useCreate...\`, \`useUpdate...\`

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
  },

  curl: (appName, featureName, fields) => {
    const baseUrl = `http://localhost:5000/api/v1/${appName.toLowerCase()}/${featureName}`;
    const authUrl = `http://localhost:5000/api/v1/${appName.toLowerCase()}/user/login`;
    const payload = buildReadmePayload(fields);
    
    return `# 🚀 Commandes cURL pour tester ${featureName}

Ces commandes permettent de tester rapidement votre API depuis un terminal.
Assurez-vous d'avoir un token JWT valide (login admin).

## 🌍 Variables d'environnement
Copiez ces lignes dans votre terminal (Git Bash recommandé sur Windows) :

\`\`\`bash
export BASE_URL="${baseUrl}"
# Remplacez par votre token réel.
# Pour obtenir un token, faites un POST sur : ${authUrl}
export TOKEN="votre_token_jwt_ici"
\`\`\`

## 1️⃣ Lister (GET)
Récupérer la liste paginée des éléments.

\`\`\`bash
curl -X GET "$BASE_URL" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Accept: application/json"
\`\`\`

## 2️⃣ Créer (POST)
Créer un nouvel élément.

\`\`\`bash
curl -X POST "$BASE_URL" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '${payload}'
\`\`\`

## 3️⃣ Voir détails (GET ID)
Remplacez \`ID_ICI\` par l'ID retourné lors de la création.

\`\`\`bash
# Exemple ID: 64f1a2b3c4d5e6f7a8b9c0d1
curl -X GET "$BASE_URL/ID_ICI" \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

## 4️⃣ Mettre à jour (PUT)
Modifier un élément existant.

\`\`\`bash
curl -X PUT "$BASE_URL/ID_ICI" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '${payload}'
\`\`\`

## 5️⃣ Supprimer (DELETE)
Suppression logique (soft delete).

\`\`\`bash
curl -X DELETE "$BASE_URL/ID_ICI" \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`
`;
  },
};

const createFeature = async (appPath, feature, appName, options = {}) => {
  const featurePath = path.join(appPath, 'features', feature.name);

  createFile(path.join(featurePath, 'model', `${feature.name}.schema.js`), templates.model(feature.model, feature.fields));

  const actions = ['getAll', 'create', 'getById', 'update', 'delete'];
  actions.forEach((action) => {
    const controllerName = action;
    createFile(
      path.join(featurePath, 'controller', `${feature.name}.${controllerName}.controller.js`),
      templates.controller(feature.name, feature.model, action)
    );
  });

  createFile(path.join(featurePath, 'route', `${feature.name}.routes.js`), templates.routes(feature.name, feature.model, appName, options, feature.fields));

  createFile(path.join(featurePath, 'TEST_CURL.md'), templates.curl(appName, feature.name, feature.fields));

  await sleep(50);
};

const testTemplate = (appName, featureName, fields) => {
  const payload = buildTestPayload(fields);
  return `const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureServer, loginAdmin } = require('../_helpers/api');

const BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';
const APP = '${appName.toLowerCase()}';
const FEATURE = '${featureName}';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@dry.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

const ensureFetch = () => {
  if (typeof fetch !== 'function') {
    throw new Error('fetch indisponible (Node 18+ requis)');
  }
};

test('CRUD ${featureName} (smoke)', async () => {
  ensureFetch();
  const serverOk = await ensureServer(BASE_URL);
  if (!serverOk) return;

  const listRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE);
  assert.ok(listRes.status >= 200 && listRes.status < 500);

  const token = await loginAdmin(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!token) return; // pas d'admin => on saute les ecritures

  const payload = ${payload};

  const createRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  });
  const created = await createRes.json();
  assert.ok(createRes.status >= 200 && createRes.status < 500);
  const id = created?.data?._id || created?.data?.id;
  if (!id) return;

  const getRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE + '/' + id);
  assert.ok(getRes.status >= 200 && getRes.status < 500);

  const updateRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE + '/' + id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ ...payload, label: 'Maj ' + Date.now() }),
  });
  assert.ok(updateRes.status >= 200 && updateRes.status < 500);

  const deleteRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE + '/' + id, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + token,
    },
  });
  assert.ok(deleteRes.status >= 200 && deleteRes.status < 500);
});
`;
};

const createApp = async (config) => {
  const { name, features } = config;
  const ultraPro = config.ultraPro !== false;
  const projectRoot = process.cwd();
  const safeName = safeAppName(name);
  const appPath = path.join(projectRoot, 'dryApp', safeName);

  console.log('');
  console.log(title);
  console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', '│                🎨 APP CREATION WIZARD              │'));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  console.log(color('96', '─────────────────────────────────────────────────────'));
  console.log(`${info} 📱 Application: ${color('93', name)}`);
  console.log(`${info} 📋 Features: ${color('92', String(features.length))}`);
  console.log(`${info} 🔧 Mode: ${ultraPro ? color('92', 'Professionnel') : color('93', 'Standard')}`);
  console.log(color('96', '─────────────────────────────────────────────────────'));

  if (fs.existsSync(appPath)) {
    renderBox(`❌ L'application "${name}" existe déjà dans:\n${appPath}`);
    return false;
  }

  console.log('\n🎯 Démarrage de la création...\n');

  const creationSteps = [
    '📁 Création de la structure des dossiers',
    '⚙️  Génération des schémas de validation',
    '🗄️  Création des modèles de données',
    '🛠️  Génération des contrôleurs CRUD',
    '🛣️  Création des routes API',
    '🧪 Génération des tests unitaires',
    '📚 Création de la documentation',
    '🌱 Configuration du seed de données'
  ];

  const totalSteps = creationSteps.length;
  let currentStep = 0;

  try {
    // Étape 1: Structure des dossiers
    renderProgress(++currentStep, totalSteps, creationSteps[0]);
    fs.mkdirSync(path.join(appPath, 'features'), { recursive: true });
    fs.mkdirSync(path.join(appPath, 'validation'), { recursive: true });
    await sleep(100);

    // Étape 2: Schémas de validation
    renderProgress(++currentStep, totalSteps, creationSteps[1]);
    const appKey = toCamel(safeName);
    createFile(path.join(appPath, 'validation', 'schemas.js'), templates.schemas(appKey, features));
    createFile(path.join(appPath, 'validation', 'middleware.js'), templates.validationMiddleware(safeName, appKey, features));
    await sleep(100);

    // Étapes 3-6: Features individuels
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const featureStep = Math.floor((i / features.length) * 4) + 2;
      
      renderProgress(featureStep, totalSteps, `🗄️  Feature: ${feature.name} (${i + 1}/${features.length})`);
      await createFeature(appPath, feature, safeName, { ultraPro: !!ultraPro });

      // Tests de base auto-générés
      const testPath = path.join(projectRoot, 'tests', safeName, `${feature.name}.test.js`);
      createFile(testPath, testTemplate(safeName, feature.name, feature.fields));
      await sleep(50);
    }

    // Étape 7: Documentation
    renderProgress(++currentStep, totalSteps, creationSteps[6]);
    createFile(path.join(appPath, 'README.md'), templates.readme(safeName, features, { ultraPro: !!ultraPro }));
    await sleep(100);

    // Étape 8: Seed
    renderProgress(++currentStep, totalSteps, creationSteps[7]);
    createFile(path.join(appPath, 'seed.js'), templates.seed(safeName, features));
    await sleep(100);

    console.log('\n');

    // Affichage des fichiers créés
    const createdFiles = [];
    features.forEach(feature => {
      createdFiles.push(`dryApp/${safeName}/features/${feature.name}/model/${feature.name}.schema.js`);
      createdFiles.push(`dryApp/${safeName}/features/${feature.name}/controller/${feature.name}.getAll.controller.js`);
      createdFiles.push(`dryApp/${safeName}/features/${feature.name}/controller/${feature.name}.create.controller.js`);
      createdFiles.push(`dryApp/${safeName}/features/${feature.name}/controller/${feature.name}.getById.controller.js`);
      createdFiles.push(`dryApp/${safeName}/features/${feature.name}/controller/${feature.name}.update.controller.js`);
      createdFiles.push(`dryApp/${safeName}/features/${feature.name}/controller/${feature.name}.delete.controller.js`);
      createdFiles.push(`dryApp/${safeName}/features/${feature.name}/route/${feature.name}.routes.js`);
      createdFiles.push(`tests/${safeName}/${feature.name}.test.js`);
    });
    createdFiles.push(`dryApp/${safeName}/validation/schemas.js`);
    createdFiles.push(`dryApp/${safeName}/validation/middleware.js`);
    createdFiles.push(`dryApp/${safeName}/README.md`);
    createdFiles.push(`dryApp/${safeName}/seed.js`);

    renderBox(
      `📁 FICHIERS CRÉÉS (${createdFiles.length})\n\n` +
      createdFiles.slice(0, 10).map(f => `✅ ${f}`).join('\n') +
      (createdFiles.length > 10 ? `\n... et ${createdFiles.length - 10} autres` : '')
    );

    console.log('\n');

    // Tableau récapitulatif
    const stats = {
      'Modèles': features.length,
      'Contrôleurs': features.length * 5,
      'Routes': features.length,
      'Tests': features.length,
      'Validation': 2,
      'Documentation': 2
    };

    console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
    console.log(color('96', '│                   📊 STATISTIQUES                  │'));
    console.log(color('96', '╰─────────────────────────────────────────────────────╯'));

    Object.entries(stats).forEach(([key, value]) => {
      const icon = key.includes('Modèle') ? '🗄️' : 
                   key.includes('Contrôleur') ? '🎮' : 
                   key.includes('Route') ? '🛣️' : 
                   key.includes('Test') ? '🧪' : 
                   key.includes('Doc') ? '📚' : '⚙️';
      console.log(`${icon} ${key.padEnd(12)}: ${color('92', String(value))} fichier(s)`);
    });

    console.log(color('96', '─────────────────────────────────────────────────────'));

    // Tableau des features
    const featureRows = features.map((f, i) => [
      `⚙️ ${f.name}`,
      f.model,
      `${f.fields?.length || 0} champs`,
      color('92', '✅ CRÉÉ')
    ]);

    console.log(color('96', '\n╭─────────────────────────────────────────────────────╮'));
    console.log(color('96', '│                   ⚙️ FEATURES CRÉÉES                │'));
    console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
    renderTable(featureRows, ['Feature', 'Modèle', 'Champs', 'Statut']);

    // Message de succès
    const timestamp = new Date().toLocaleString('fr-FR', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    console.log(color('96', '─────────────────────────────────────────────────────'));
    console.log(`${info} 🕐 Créé: ${timestamp}`);
    console.log(`${info} 📂 Chemin: ${color('92', appPath)}`);
    console.log(color('96', '─────────────────────────────────────────────────────'));

    console.log(`\n${success} 🎉 APPLICATION CRÉÉE AVEC SUCCÈS!`);
    console.log(`${info} 📝 Prochaines étapes:`);
    console.log(`   • cd dryApp/${safeName}`);
    console.log(`   • npm install`);
    console.log(`   • npm run dev`);

    console.log('\n' + color('96', '─────────────────────────────────────────────────────'));
    console.log(color('96', '│                   🌟 BON DÉVELOPPEMENT!             │'));
    console.log(color('96', '─────────────────────────────────────────────────────'));

    return true;
  } catch (error) {
    console.log(`\n${error} 🚨 ERREUR: ${error.message}`);
    return false;
  }
};

const showMainMenu = async () => {
  console.clear();
  console.log(title);
  console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', '│                🎨 APP CREATION WIZARD              │'));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  console.log(color('96', '─────────────────────────────────────────────────────'));
  console.log(`${info} 📋 Choisissez un mode de création:`);
  console.log(color('96', '─────────────────────────────────────────────────────'));
  
  const menuOptions = [
    { num: '1', title: 'Mode Professionnel', desc: 'Templates pré-configurés', icon: '🏢' },
    { num: '2', title: 'Mode Personnalisé', desc: 'Configuration complète', icon: '🛠️' },
    { num: '3', title: 'Mode Rapide', desc: 'Application simple', icon: '⚡' },
    { num: '0', title: 'Quitter', desc: 'Retour au terminal', icon: '🚪' }
  ];

  menuOptions.forEach(option => {
    console.log(`${color('93', option.num)}) ${option.icon} ${color('96', option.title.padEnd(20))} ${color('90', `— ${option.desc}`)}`);
  });

  console.log(color('96', '─────────────────────────────────────────────────────'));

  const choice = await question('\n🎯 Ton choix (0-3): ');
  return choice.trim();
};

const templateMode = async () => {
  console.log('');
  console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', '│                   🏢 TEMPLATES PROS               │'));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  console.log(color('96', '─────────────────────────────────────────────────────'));

  const templateList = [
    { num: '1', name: 'RestoPro', desc: 'Gestion restaurant complet', icon: '🍽️', features: 5 },
    { num: '2', name: 'FitnessPro', desc: 'Salle de sport', icon: '💪', features: 5 },
    { num: '3', name: 'ShopPro', desc: 'E-commerce moderne', icon: '🛒', features: 4 },
    { num: '4', name: 'BlogPro', desc: 'Blog professionnel', icon: '📝', features: 3 },
    { num: '5', name: 'ImmoPro', desc: 'Gestion immobilière', icon: '🏠', features: 3 },
    { num: '6', name: 'HealthPro', desc: 'Gestion santé', icon: '🏥', features: 3 },
    { num: '7', name: 'EduPro', desc: 'Éducation/formation', icon: '🎓', features: 3 },
    { num: '0', name: 'Retour', desc: 'Menu principal', icon: '🔙', features: 0 }
  ];

  const templateRows = templateList.map(t => [
    `${t.icon} ${t.num}`,
    t.name,
    t.desc,
    `${t.features} features`,
    t.num === '0' ? color('90', '—') : color('92', '✅')
  ]);

  renderTable(templateRows, ['Choix', 'Template', 'Description', 'Features', 'Dispo']);

  console.log(color('96', '─────────────────────────────────────────────────────'));

  const templateChoice = await question('\n🎯 Choisis un template (0-7): ');
  if (templateChoice === '0') return;

  const templates = ['restaurant', 'fitness', 'ecommerce', 'blog', 'immobilier', 'sante', 'education'];
  const selected = templates[parseInt(templateChoice, 10) - 1];

  if (!selected || !PROFESSIONAL_TEMPLATES[selected]) {
    renderBox(`❌ Template invalide: ${templateChoice}`);
    return;
  }

  const tpl = PROFESSIONAL_TEMPLATES[selected];
  
  console.log('');
  console.log(color('96', '╭─────────────────────────────────────────────────────╮'));
  console.log(color('96', `│                   📋 RÉCAPITULATIF                  │`));
  console.log(color('96', '╰─────────────────────────────────────────────────────╯'));
  console.log(color('96', '─────────────────────────────────────────────────────'));
  console.log(`${info} 📱 Nom: ${color('93', tpl.name)}`);
  console.log(`${info} 📝 Description: ${color('96', tpl.desc)}`);
  console.log(`${info} ⚙️  Features: ${color('92', tpl.features.map(f => f.name).join(', '))}`);
  console.log(`${info} 🔧 Mode: ${color('92', 'Professionnel')}`);
  console.log(color('96', '─────────────────────────────────────────────────────'));

  const confirm = await question('\n✅ Confirmer la création ? (y/n): ');
  if (confirm.toLowerCase() === 'y') {
    await createApp({ name: tpl.name, features: tpl.features, ultraPro: true });
  }
};

const customMode = async () => {
  console.log(color('bright', color('magenta', '\nMODE PERSONNALISE')));
  const appNameRaw = await question("Nom de l'application: ");
  const appName = safeAppName(appNameRaw);
  const featuresInput = await question('Features (separees par des virgules): ');
  const features = featuresInput
    .split(',')
    .map((f) => normalizeKey(f.toLowerCase()))
    .filter(Boolean);

  const featureDetails = [];
  for (const feature of features) {
    const modelName = toPascal(feature);
    const fieldsInput = await question(`Champs pour ${modelName} (ex: nom:String,email:String): `);
    const fields = fieldsInput.split(',').map((f) => f.trim()).filter(Boolean);
    featureDetails.push({ name: feature, model: modelName, fields });
  }

  const confirm = await question('\nConfirmer la creation ? (y/n): ');
  if (confirm.toLowerCase() === 'y') {
    await createApp({ name: appName, features: featureDetails, ultraPro: true });
  }
};

const quickMode = async () => {
  console.log(color('bright', color('green', '\nMODE RAPIDE')));
  const appNameRaw = await question("Nom de l'application: ");
  const appName = safeAppName(appNameRaw);

  const quickFeature = {
    name: 'items',
    model: 'Item',
    fields: ['name:String', 'description:String', 'price:Number'],
  };

  const confirm = await question('\nConfirmer la creation rapide ? (y/n): ');
  if (confirm.toLowerCase() === 'y') {
    await createApp({ name: appName, features: [quickFeature], ultraPro: true });
  }
};

const main = async () => {
  try {
    while (true) {
      const choice = await showMainMenu();
      if (choice === '1') await templateMode();
      else if (choice === '2') await customMode();
      else if (choice === '3') await quickMode();
      else if (choice === '0') {
        log('A bientot', 'info');
        rl.close();
        process.exit(0);
      } else {
        log('Choix invalide', 'error');
      }

      if (choice !== '0') {
        await question('\nAppuie sur Entree pour continuer...');
      }
    }
  } catch (error) {
    log(`Erreur: ${error.message}`, 'error');
    rl.close();
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  log('Arret du generateur...', 'info');
  rl.close();
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { createApp }; 
