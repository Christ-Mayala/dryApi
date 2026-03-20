const mongoose = require('mongoose');

/**
 * Recupere le modele SeedLog pour la DB donnee
 */
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

/**
 * Logge une operation de seed dans la DB du tenant
 */
const logSeed = async ({ appName, feature, modelName, schemaPath, ids }) => {
  if (!ids || !ids.length) return;
  const { getTenantDB } = require('../../dry/config/connection/dbConnection');
  const db = getTenantDB(appName);
  const SeedLog = getSeedLogModel(db);
  
  await SeedLog.create({
    appName,
    feature,
    modelName,
    schemaPath,
    ids,
  });
};

module.exports = {
  logSeed,
  getSeedLogModel
};
