#!/usr/bin/env node

/**
 * Regénère des blocs Swagger standard pour les apps dryApp
 * - Basé sur la structure /dryApp/<App>/features/<feature>/route/*.routes.js
 * - Ajoute SuccessResponse + ErrorResponse
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_APP = path.join(ROOT, 'dryApp');

const buildBlock = (appName, featureName, modelName) => {
  const appKey = appName.toLowerCase();
  return `/**
 * @swagger
 * /api/v1/${appKey}/${featureName}:
 *   get:
 *     summary: Lister ${modelName}
 *     tags: [${appName}]
 *     responses:
 *       200:
 *         description: Liste ${modelName}
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: Creer ${modelName}
 *     tags: [${appName}]
 *     responses:
 *       200:
 *         description: ${modelName} cree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/v1/${appKey}/${featureName}/{id}:
 *   get:
 *     summary: Recuperer ${modelName} par ID
 *     tags: [${appName}]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ${modelName} recupere
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: Mettre a jour ${modelName}
 *     tags: [${appName}]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ${modelName} mis a jour
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: Supprimer ${modelName}
 *     tags: [${appName}]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ${modelName} supprime
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Erreur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
`;
};

const cleanSwagger = (content) => {
  return content.replace(/\/\*\*[\s\S]*?@swagger[\s\S]*?\*\//g, '');
};

const injectBlock = (content, block) => {
  const lines = content.split('\n');
  const insertAt = lines.findIndex((l) => l.startsWith('const ') || l.includes('require(') || l.startsWith('router'));
  const idx = insertAt >= 0 ? insertAt + 1 : 0;
  lines.splice(idx, 0, block);
  return lines.join('\n');
};

const run = () => {
  if (!fs.existsSync(DRY_APP)) {
    console.log('[swagger] dryApp introuvable');
    return;
  }

  const apps = fs.readdirSync(DRY_APP).filter((a) => !a.startsWith('.'));
  apps.forEach((appName) => {
    const featuresPath = path.join(DRY_APP, appName, 'features');
    if (!fs.existsSync(featuresPath)) return;
    const features = fs.readdirSync(featuresPath).filter((f) => !f.startsWith('.'));
    features.forEach((feature) => {
      const routePath = path.join(featuresPath, feature, 'route');
      if (!fs.existsSync(routePath)) return;
      const files = fs.readdirSync(routePath).filter((f) => f.endsWith('.routes.js'));
      files.forEach((file) => {
        const p = path.join(routePath, file);
        let content = fs.readFileSync(p, 'utf8');
        content = cleanSwagger(content);
        const block = buildBlock(appName, feature, feature.charAt(0).toUpperCase() + feature.slice(1));
        content = injectBlock(content, block);
        fs.writeFileSync(p, content, 'utf8');
        console.log(`✅ Swagger regen: ${path.relative(ROOT, p)}`);
      });
    });
  });
};

run();
