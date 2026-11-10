#!/usr/bin/env node

/**
 * Seed du dossier Trivida (app Nova) uniquement.
 *
 * Utile pour (re)appliquer le contenu Trivida sans lancer le seed global de
 * toutes les applications. Additif et idempotent : ne supprime jamais rien et
 * ne cree jamais un second espace de travail.
 *
 * Usage : node scripts/seed/seed-nova-trivida.js
 *    ou : npm run seed:nova-trivida
 */

require('dotenv').config();
const path = require('path');

const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');
const { logSeed } = require('./seed-util');
const seedTrivida = require('../../dryApp/Nova/seeds/trivida.seed');

const APP_NAME = 'Nova';
const log = (msg) => console.log(`[trivida-seed] ${msg}`);

const run = async () => {
  await connectCluster();
  getTenantDB(APP_NAME);

  // Comme seed-all : laisser l'app enregistrer son propre modele User avant
  // toute compilation par defaut, puis charger le seed.
  const appIndexPath = path.join(__dirname, '../../dryApp', APP_NAME, 'index.js');
  try {
    const appModule = require(appIndexPath);
    if (typeof appModule.bootstrap === 'function') {
      await appModule.bootstrap(APP_NAME);
    }
  } catch (erreur) {
    log(`bootstrap ignore -> ${erreur.message}`);
  }

  const resultat = await seedTrivida({ appName: APP_NAME, getModel, logSeed });

  if (resultat.skipped) {
    log(`ignore : ${resultat.raison}`);
  } else {
    log(`termine : ${resultat.count} document(s) cree(s)`);
    log(`espace ${resultat.espaceId} · page maitre ${resultat.pageMaitreId} · ${resultat.bases} tableau(x)`);
  }
};

run()
  .then(() => process.exit(0))
  .catch((erreur) => {
    console.error(`[trivida-seed] erreur -> ${erreur.message}`);
    process.exit(1);
  });
