/**
 * Migration 001 - Schéma Initial
 * Crée les collections de base avec leurs index
 * @module migrations/001-initial-schema
 */

'use strict';

const { MongoClient } = require('mongodb');

/**
 * Crée la collection des utilisateurs avec index
 */
const createUsersCollection = async (db) => {
  const collections = await db.listCollections({ name: 'users' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('users');
  }

  const users = db.collection('users');

  // Index essentiels
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });
  await users.createIndex({ role: 1 });
  await users.createIndex({ status: 1 });
  await users.createIndex({ createdAt: -1 });
  await users.createIndex({ 'premiumUntil': 1 }, { sparse: true });
  await users.createIndex({ resetToken: 1 }, { sparse: true });

  // Index de recherche textuelle
  await users.createIndex(
    { name: 'text', email: 'text' },
    { weights: { name: 10, email: 5 }, name: 'users_text_search' }
  );
};

/**
 * Crée la collection des conversations avec index
 */
const createConversationsCollection = async (db) => {
  const collections = await db.listCollections({ name: 'conversations' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('conversations');
  }

  const conversations = db.collection('conversations');
  await conversations.createIndex({ userId: 1, createdAt: -1 });
  await conversations.createIndex({ status: 1 });
  await conversations.createIndex({ model: 1 });
};

/**
 * Crée la collection des clés API avec index
 */
const createApiKeysCollection = async (db) => {
  const collections = await db.listCollections({ name: 'apikeys' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('apikeys');
  }

  const apiKeys = db.collection('apikeys');
  await apiKeys.createIndex({ key: 1 }, { unique: true });
  await apiKeys.createIndex({ userId: 1 });
  await apiKeys.createIndex({ status: 1 });
  await apiKeys.createIndex({ expiresAt: 1 }, { sparse: true });
};

/**
 * Crée la collection des logs d'audit avec index
 */
const createAuditLogsCollection = async (db) => {
  const collections = await db.listCollections({ name: 'auditlogs' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('auditlogs');
  }

  const auditLogs = db.collection('auditlogs');
  await auditLogs.createIndex({ userId: 1, timestamp: -1 });
  await auditLogs.createIndex({ resourceType: 1, resourceId: 1 });
  await auditLogs.createIndex({ action: 1, timestamp: -1 });
  await auditLogs.createIndex({ tenantId: 1, timestamp: -1 });
  await auditLogs.createIndex({ timestamp: -1 });

  // Index TTL pour auto-nettoyage après 90 jours
  await auditLogs.createIndex(
    { timestamp: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'audit_logs_ttl' }
  );
};

/**
 * Crée la collection des sessions avec index TTL
 */
const createSessionsCollection = async (db) => {
  const collections = await db.listCollections({ name: 'sessions' }).toArray();
  if (collections.length === 0) {
    await db.createCollection('sessions');
  }

  const sessions = db.collection('sessions');
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await sessions.createIndex({ userId: 1 });
};

/**
 * Execute la migration
 * @param {MongoClient} client - Connexion MongoDB
 */
const up = async (client) => {
  const db = client.db();

  await createUsersCollection(db);
  await createConversationsCollection(db);
  await createApiKeysCollection(db);
  await createAuditLogsCollection(db);
  await createSessionsCollection(db);

  console.log('[Migration 001] Collections créées avec index');
};

/**
 * Annule la migration
 * @param {MongoClient} client - Connexion MongoDB
 */
const down = async (client) => {
  const db = client.db();
  const collectionsToDrop = [
    'users',
    'conversations',
    'apikeys',
    'auditlogs',
    'sessions',
  ];

  for (const name of collectionsToDrop) {
    try {
      await db.collection(name).drop();
      console.log(`[Migration 001] Collection ${name} supprimée`);
    } catch (error) {
      if (error.code !== 26) { // Ignorer si la collection n'existe pas
        console.error(`[Migration 001] Erreur lors de la suppression de ${name}:`, error.message);
      }
    }
  }
};

module.exports = { up, down };
