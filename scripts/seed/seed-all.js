#!/usr/bin/env node

/**
 * Seeder global DRY
 * - Cree un admin par application si absent
 *
 * Variables optionnelles:
 * - SEED_ADMIN_EMAIL
 * - SEED_ADMIN_PASSWORD
 * - SEED_ADMIN_NAME
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectCluster } = require('../dry/config/connection/dbConnection');
const { getTenantDB } = require('../dry/config/connection/dbConnection');
const getModel = require('../dry/core/factories/modelFactory');

const log = (msg) => console.log(`[seed-all] ${msg}`);

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dry.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
const adminName = process.env.SEED_ADMIN_NAME || 'Admin DRY';

const run = async () => {
  const dryAppPath = path.join(__dirname, '../dryApp');
  if (!fs.existsSync(dryAppPath)) {
    log('Dossier dryApp introuvable.');
    process.exit(1);
  }

  const apps = fs.readdirSync(dryAppPath).filter((name) => {
    const p = path.join(dryAppPath, name);
    return fs.statSync(p).isDirectory() && !name.startsWith('.');
  });

  if (!apps.length) {
    log('Aucune application detectee.');
    return;
  }

  await connectCluster();

  for (const appName of apps) {
    try {
      getTenantDB(appName);
      const User = getModel(appName, 'User');

      const existing = await User.findOne({ email: adminEmail }).select('+password');
      if (!existing) {
        await User.create({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
          status: 'active',
        });
        log(`${appName}: admin cree (${adminEmail})`);
      } else {
        log(`${appName}: admin deja present`);
      }

      // Seed individuel des apps desactive (on garde uniquement les users/admins)
      log(`${appName}: seed individuel ignore`);
    } catch (error) {
      log(`${appName}: erreur seed -> ${error.message}`);
    }
  }
};

run()
  .then(() => {
    log('Termine.');
    process.exit(0);
  })
  .catch((err) => {
    log(`Erreur globale: ${err.message}`);
    process.exit(1);
  });
