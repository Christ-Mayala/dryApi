#!/usr/bin/env node

/**
 * Génère une collection Postman basée sur /dryApp
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY_APP = path.join(ROOT, 'dryApp');
const OUT = path.join(ROOT, 'generated', 'postman');

const writeFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const buildItem = (app, feature) => {
  const base = `{{baseUrl}}/api/v1/${app}/${feature}`;
  return [
    {
      name: `${feature} - list`,
      request: { method: 'GET', header: [], url: { raw: base, host: ['{{baseUrl}}'], path: ['api','v1',app,feature] } },
    },
    {
      name: `${feature} - create`,
      request: {
        method: 'POST',
        header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        url: { raw: base, host: ['{{baseUrl}}'], path: ['api','v1',app,feature] },
        body: { mode: 'raw', raw: '{}' },
      },
    },
    {
      name: `${feature} - get by id`,
      request: {
        method: 'GET',
        header: [],
        url: { raw: `${base}/:id`, host: ['{{baseUrl}}'], path: ['api','v1',app,feature,':id'] },
      },
    },
    {
      name: `${feature} - update`,
      request: {
        method: 'PUT',
        header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        url: { raw: `${base}/:id`, host: ['{{baseUrl}}'], path: ['api','v1',app,feature,':id'] },
        body: { mode: 'raw', raw: '{}' },
      },
    },
    {
      name: `${feature} - delete`,
      request: {
        method: 'DELETE',
        header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        url: { raw: `${base}/:id`, host: ['{{baseUrl}}'], path: ['api','v1',app,feature,':id'] },
      },
    },
  ];
};

const generate = () => {
  if (!fs.existsSync(DRY_APP)) {
    console.log('[postman] dryApp introuvable');
    return;
  }

  const apps = fs.readdirSync(DRY_APP).filter((a) => !a.startsWith('.'));
  const items = [];

  apps.forEach((appName) => {
    const featuresPath = path.join(DRY_APP, appName, 'features');
    if (!fs.existsSync(featuresPath)) return;
    const features = fs.readdirSync(featuresPath).filter((f) => !f.startsWith('.'));
    const appItems = [];
    features.forEach((feature) => {
      appItems.push(...buildItem(appName.toLowerCase(), feature));
    });
    items.push({ name: appName, item: appItems });
  });

  const collection = {
    info: {
      name: 'DRY API Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
    variable: [
      { key: 'baseUrl', value: 'http://localhost:5000' },
      { key: 'token', value: '' },
    ],
  };

  writeFile(path.join(OUT, 'dry-api.postman_collection.json'), JSON.stringify(collection, null, 2));
  console.log('[postman] Collection générée');
};

generate();
