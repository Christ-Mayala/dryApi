#!/usr/bin/env node
/**
 * Seed rapide — Trivida uniquement
 * Usage: node dryApi/dryApp/Trivida/seed-run.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');
const { logSeed } = require('../../scripts/seed/seed-util');

const log = (msg) => console.log(`[trivida-seed] ${msg}`);

const run = async () => {
    const appName = 'Trivida';
    
    log('Connexion à MongoDB...');
    await connectCluster();
    
    log(`Initialisation de ${appName}...`);
    getTenantDB(appName);
    
    const seed = require('./seed');
    await seed({ appName, getModel, logSeed });
    
    log('Terminé !');
};

run()
    .then(() => process.exit(0))
    .catch((err) => {
        log(`Erreur: ${err.message}`);
        process.exit(1);
    });
