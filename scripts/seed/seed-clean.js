const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectCluster, getTenantDB } = require('../dry/config/connection/dbConnection');
const getModel = require('../dry/core/factories/modelFactory');

const DRY_APP = path.join(__dirname, '..', 'dryApp');

const log = (msg) => console.log(`[seed-clean] ${msg}`);

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

const run = async () => {
  const apps = getApps();
  if (!apps.length) {
    log('Aucune application detectee.');
    return;
  }

  await connectCluster();

  for (const appName of apps) {
    try {
      const db = getTenantDB(appName);
      const SeedLog = getSeedLogModel(db);
      const logs = await SeedLog.find({ appName }).lean();

      if (!logs.length) {
        log(`${appName}: aucun seed log`);
        continue;
      }

      for (const entry of logs) {
        if (!entry.modelName || !entry.schemaPath || !entry.ids?.length) continue;

        if (entry.modelName.toLowerCase() === 'user' || entry.modelName.toLowerCase() === 'users') {
          log(`${appName}: skip users`);
          continue;
        }

        if (!fs.existsSync(entry.schemaPath)) {
          log(`${appName}: schema introuvable pour ${entry.modelName} -> ${entry.schemaPath}`);
          continue;
        }

        const schema = require(entry.schemaPath);
        const Model = getModel(appName, entry.modelName, schema);
        await Model.deleteMany({ _id: { $in: entry.ids } });

        log(`${appName}: clean ${entry.modelName} (${entry.ids.length})`);
      }

      await SeedLog.deleteMany({ appName });
    } catch (error) {
      log(`${appName}: erreur clean -> ${error.message}`);
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
