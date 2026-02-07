#!/usr/bin/env node

/**
 * Corrige les blocs Swagger dont certaines lignes n'ont pas le prefixe " * "
 * (cas des properties generees sans prefixe).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_APP = path.join(ROOT, 'dryApp');

const fixContent = (content) => {
  const lines = content.split('\n');
  let inBlock = false;
  let isSwagger = false;
  const out = [];

  for (const line of lines) {
    if (line.includes('/**')) {
      inBlock = true;
      isSwagger = false;
      out.push(line);
      continue;
    }

    if (inBlock) {
      if (line.includes('@swagger')) {
        isSwagger = true;
        out.push(line);
        continue;
      }

      if (line.includes('*/')) {
        inBlock = false;
        isSwagger = false;
        out.push(line);
        continue;
      }

      if (isSwagger) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('*')) {
          out.push(` * ${line}`);
          continue;
        }
      }
    }

    out.push(line);
  }

  return out.join('\n');
};

const run = () => {
  if (!fs.existsSync(DRY_APP)) {
    console.log('[swagger-fix] dryApp introuvable');
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
        const content = fs.readFileSync(p, 'utf8');
        const fixed = fixContent(content);
        if (fixed !== content) {
          fs.writeFileSync(p, fixed, 'utf8');
          console.log('[swagger-fix] ok', path.relative(ROOT, p));
        }
      });
    });
  });
};

run();
