const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectCluster, getTenantDB } = require('../dry/config/connection/dbConnection');
const getModel = require('../dry/core/factories/modelFactory');

const DRY_APP = path.join(__dirname, '..', 'dryApp');

const log = (msg) => console.log(`[seed-apps] ${msg}`);

const getApps = () => {
  if (!fs.existsSync(DRY_APP)) return [];
  return fs.readdirSync(DRY_APP).filter((name) => !name.startsWith('.'));
};

const getSeedLogModel = (db) => {
  if (db.models.SeedLog) return db.models.SeedLog;
  const schema = new mongoose.Schema(
    {
      appName: String,
      feature: String,
      modelName: String,
      schemaPath: String,
      ids: [mongoose.Schema.Types.ObjectId],
      createdAt: { type: Date, default: Date.now },
    },
    { collection: '__seed_logs' }
  );
  return db.model('SeedLog', schema);
};

const logSeed = async (db, payload) => {
  if (!payload || !payload.ids || !payload.ids.length) return;
  const SeedLog = getSeedLogModel(db);
  await SeedLog.create({
    appName: payload.appName,
    feature: payload.feature,
    modelName: payload.modelName,
    schemaPath: payload.schemaPath,
    ids: payload.ids,
  });
};

const run = async () => {
  const apps = getApps();
  if (!apps.length) {
    log('Aucune application detectee.');
    return;
  }

  await connectCluster();

  for (const appName of apps) {
    try {
      const seedPath = path.join(DRY_APP, appName, 'seed.js');
      if (!fs.existsSync(seedPath)) {
        log(`${appName}: pas de seed.js (ignore)`);
        continue;
      }

      const db = getTenantDB(appName);
      const seedModule = require(seedPath);
      if (typeof seedModule !== 'function') {
        log(`${appName}: seed.js invalide (exporte une fonction)`);
        continue;
      }

      const result = await seedModule({
        appName,
        getModel,
        logSeed: (payload) => logSeed(db, payload),
      });

      log(`${appName}: seed OK${result?.count ? ` (${result.count})` : ''}`);
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
