#!/usr/bin/env node

/**
 * Seed cible pour le tenant Pelerin uniquement (jamais les autres tenants).
 * Additif uniquement : appelle dryApp/Pelerin/seed.js, qui verifie lui-meme
 * (countDocuments) avant d'inserer quoi que ce soit — voir la convention
 * documentee dans scripts/seed/seed-all.js. Ne supprime jamais rien.
 */

require('dotenv').config();

// Ce sandbox refuse parfois les requetes DNS SRV (mongodb+srv://) via son
// resolveur par defaut, meme si le reseau sortant fonctionne autrement.
// Fix local a ce script uniquement (jamais dans dry/ ni un script global).
require('dns').setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');
const { logSeed } = require('./seed-util');

const log = (msg) => console.log(`[seed-pelerin-demo] ${msg}`);

const run = async () => {
  await connectCluster();
  getTenantDB('Pelerin');
  log('PelerinDB connectee.');

  const pelerinSeed = require(path.join(__dirname, '..', '..', 'dryApp', 'Pelerin', 'seed.js'));
  const result = await pelerinSeed({ appName: 'Pelerin', getModel, logSeed });

  log(`Termine. ${result?.count ?? 0} document(s) au total (BibleBook + donnees de demo).`);
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    log(`Erreur: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
