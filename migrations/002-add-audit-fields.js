/**
 * Migration 002 - Champs d'Audit
 * Ajoute les champs createdBy, updatedBy, deletedAt aux collections existantes
 * @module migrations/002-add-audit-fields
 */

'use strict';

/**
 * Ajoute les champs d'audit à toutes les collections d'une application
 * @param {object} db - Connexion MongoDB
 * @param {string} collectionName - Nom de la collection
 */
const addAuditFieldsToCollection = async (db, collectionName) => {
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) return;

  const collection = db.collection(collectionName);

  // Mise à jour en masse pour ajouter les champs si absents
  await collection.updateMany(
    { createdBy: { $exists: false } },
    { $set: { createdBy: null } }
  );
  await collection.updateMany(
    { updatedBy: { $exists: false } },
    { $set: { updatedBy: null } }
  );
  await collection.updateMany(
    { deletedAt: { $exists: false } },
    { $set: { deletedAt: null } }
  );

  // Créer les index pour les champs d'audit
  await collection.createIndex({ createdBy: 1 }, { sparse: true });
  await collection.createIndex({ deletedAt: 1 }, { sparse: true });

  console.log(`[Migration 002] Champs d'audit ajoutés à ${collectionName}`);
};

/**
 * Execute la migration
 * @param {MongoClient} client - Connexion MongoDB
 */
const up = async (client) => {
  const db = client.db();
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  // Ignorer les collections système
  const systemCollections = ['system.users', 'system.sessions', 'system.version'];
  const targetCollections = collectionNames.filter(
    (name) => !name.startsWith('system.') && !systemCollections.includes(name)
  );

  for (const name of targetCollections) {
    await addAuditFieldsToCollection(db, name);
  }

  console.log(`[Migration 002] ${targetCollections.length} collection(s) mises à jour`);
};

/**
 * Annule la migration (retire les index, pas les champs pour éviter perte de données)
 * @param {MongoClient} client - Connexion MongoDB
 */
const down = async (client) => {
  const db = client.db();
  const collections = await db.listCollections().toArray();

  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    try {
      await db.collection(name).dropIndex('createdBy_1');
      await db.collection(name).dropIndex('deletedAt_1');
    } catch (error) {
      if (error.code !== 27) {
        // Ignorer si l'index n'existe pas
        console.error(`[Migration 002] Erreur pour ${name}:`, error.message);
      }
    }
  }

  console.log('[Migration 002] Index d\'audit supprimés');
};

module.exports = { up, down };
