#!/usr/bin/env node

/**
 * Supprime tous les blocs Swagger des fichiers .routes.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_APP = path.join(ROOT, 'dryApp');
const DRY_MODULES = path.join(ROOT, 'dry', 'modules');

const cleanFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content.length;
  content = content.replace(/\/\*\*[\s\S]*?@swagger[\s\S]*?\*\//g, '');
  fs.writeFileSync(filePath, content, 'utf8');
  const after = content.length;
  if (before !== after) {
    console.log(`🧹 Clean: ${path.relative(ROOT, filePath)}`);
  }
};

const scan = (base) => {
  if (!fs.existsSync(base)) return;
  const items = fs.readdirSync(base);
  items.forEach((item) => {
    const p = path.join(base, item);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      scan(p);
    } else if (item.endsWith('.routes.js')) {
      cleanFile(p);
    }
  });
};

scan(DRY_APP);
scan(DRY_MODULES);

console.log('✅ Nettoyage Swagger terminé');
