#!/usr/bin/env node
require('dotenv').config();

// Le DNS local ne relaie pas les enregistrements SRV requis par mongodb+srv:// — on force un résolveur public.
if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb+srv://')) {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
}

const path = require('path');
const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const log = (msg) => console.log(`[seed-scim] ${msg}`);

const run = async () => {
  console.log(`[seed-scim] MONGO_URI = ${process.env.MONGO_URI}`);
  await connectCluster();
  getTenantDB('SCIM');

  const appSeedPath = path.join(__dirname, '../../dryApp/SCIM/seed.js');
  const appSeed = require(appSeedPath);
  const { logSeed } = require('./seed-util');

  log('Lancement du seed SCIM...');
  await appSeed({ appName: 'SCIM', getModel, logSeed });
  log('Seed SCIM termine.');
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    log(`Erreur: ${err.message}`);
    console.error(err);
    process.exit(1);
  });
