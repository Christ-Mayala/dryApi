#!/usr/bin/env node

/**
 * Seeder global DRY
 * - Cree un admin par application si absent
 * - Appelle le seed.js de chaque app detectee dans dryApp/
 *
 * CONVENTION (obligatoire pour tout seed.js) : additif uniquement, jamais
 * destructeur. Un seed.js ne doit jamais faire deleteMany({})/drop() sur des
 * donnees potentiellement reelles - il doit detecter que ses donnees existent
 * deja (upsert par cle naturelle, ou skip si la collection cible a deja des
 * documents) et ne rien faire dans ce cas plutot que d'ecraser. Pour repartir
 * d'une base de demo vierge volontairement, utiliser la commande separee et
 * explicite `npm run seed:reset` (seed-clean.js, qui ne supprime que ce que le
 * seed a lui-meme cree via le journal __seed_logs, puis relance ce script).
 * `npm run seed` seul ne doit jamais rien supprimer.
 *
 * Variables optionnelles:
 * - SEED_ADMIN_EMAIL
 * - SEED_ADMIN_PASSWORD
 * - SEED_ADMIN_NAME
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectCluster } = require('../../dry/config/connection/dbConnection');
const { getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const log = (msg) => console.log(`[seed-all] ${msg}`);

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dry.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
const adminName = process.env.SEED_ADMIN_NAME || 'Admin DRY';

const run = async () => {
  const dryAppPath = path.join(__dirname, '../../dryApp');
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

      // Seed individuel des apps
      const appSeedPath = path.join(dryAppPath, appName, 'seed.js');
      if (fs.existsSync(appSeedPath)) {
        log(`${appName}: lancement du seed specifique...`);
        const appSeed = require(appSeedPath);
        const { logSeed } = require('./seed-util'); // Helper pour logger les IDs generes
        await appSeed({ appName, getModel, logSeed });
        log(`${appName}: seed specifique termine`);
      } else {
        log(`${appName}: aucun seed specifique trouve`);
      }
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
