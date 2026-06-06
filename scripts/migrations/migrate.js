/**
 * Lanceur de Migrations
 * Gère l'exécution, l'état et le rollback des migrations MongoDB
 * @module scripts/migrations/migrate
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const MIGRATIONS_COLLECTION = '_migrations';

/**
 * Charge les fichiers de migration
 * @returns {Array} Liste des migrations triées
 */
const loadMigrations = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js') && !file.startsWith('_'))
    .sort()
    .map((file) => ({
      name: path.basename(file, '.js'),
      file: path.join(MIGRATIONS_DIR, file),
    }));
};

/**
 * Récupère les migrations déjà exécutées
 * @param {object} db - Connexion MongoDB
 * @returns {Set} Ensemble des noms de migrations exécutées
 */
const getExecutedMigrations = async (db) => {
  try {
    const docs = await db
      .collection(MIGRATIONS_COLLECTION)
      .find({})
      .sort({ executedAt: 1 })
      .toArray();
    return new Set(docs.map((d) => d.name));
  } catch {
    return new Set();
  }
};

/**
 * Enregistre une migration comme exécutée
 * @param {object} db - Connexion MongoDB
 * @param {string} name - Nom de la migration
 */
const recordMigration = async (db, name) => {
  await db.collection(MIGRATIONS_COLLECTION).insertOne({
    name,
    executedAt: new Date(),
  });
};

/**
 * Supprime l'enregistrement d'une migration
 * @param {object} db - Connexion MongoDB
 * @param {string} name - Nom de la migration
 */
const unrecordMigration = async (db, name) => {
  await db.collection(MIGRATIONS_COLLECTION).deleteOne({ name });
};

/**
 * Exécute les migrations en attente
 * @param {MongoClient} client - Connexion MongoDB
 */
const runMigrations = async (client) => {
  const db = client.db();
  const migrations = loadMigrations();
  const executed = await getExecutedMigrations(db);
  const pending = migrations.filter((m) => !executed.has(m.name));

  if (pending.length === 0) {
    console.log('[Migrate] Aucune migration en attente');
    return;
  }

  console.log(`[Migrate] ${pending.length} migration(s) à exécuter:`);
  for (const migration of pending) {
    console.log(`  → ${migration.name}`);
  }

  for (const migration of pending) {
    try {
      console.log(`\n[Migrate] Exécution: ${migration.name}`);
      const mod = require(migration.file);

      if (typeof mod.up === 'function') {
        await mod.up(client);
        await recordMigration(db, migration.name);
        console.log(`[Migrate] ✓ ${migration.name} réussie`);
      } else {
        console.error(`[Migrate] ✗ ${migration.name}: pas de fonction 'up' exportée`);
      }
    } catch (error) {
      console.error(`[Migrate] ✗ ${migration.name} échouée:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n[Migrate] Toutes les migrations exécutées avec succès');
};

/**
 * Annule la dernière migration
 * @param {MongoClient} client - Connexion MongoDB
 */
const rollbackLastMigration = async (client) => {
  const db = client.db();
  const migrations = loadMigrations();
  const executed = await getExecutedMigrations(db);

  // Trouver la dernière migration exécutée
  const lastExecuted = migrations
    .filter((m) => executed.has(m.name))
    .pop();

  if (!lastExecuted) {
    console.log('[Migrate] Aucune migration à annuler');
    return;
  }

  try {
    console.log(`[Migrate] Annulation: ${lastExecuted.name}`);
    const mod = require(lastExecuted.file);

    if (typeof mod.down === 'function') {
      await mod.down(client);
      await unrecordMigration(db, lastExecuted.name);
      console.log(`[Migrate] ✓ ${lastExecuted.name} annulée`);
    } else {
      console.error(`[Migrate] ✗ ${lastExecuted.name}: pas de fonction 'down' exportée`);
    }
  } catch (error) {
    console.error(`[Migrate] ✗ Annulation échouée:`, error.message);
    process.exit(1);
  }
};

/**
 * Affiche le statut des migrations
 * @param {MongoClient} client - Connexion MongoDB
 */
const showStatus = async (client) => {
  const db = client.db();
  const migrations = loadMigrations();
  const executed = await getExecutedMigrations(db);

  console.log('\n=== Statut des Migrations ===\n');

  if (migrations.length === 0) {
    console.log('Aucun fichier de migration trouvé');
    return;
  }

  for (const migration of migrations) {
    const status = executed.has(migration.name) ? '✓' : '○';
    console.log(`  ${status} ${migration.name}`);
  }

  const pending = migrations.filter((m) => !executed.has(m.name));
  console.log(`\n${executed.size} exécutée(s), ${pending.length} en attente`);
};

/**
 * Point d'entrée principal
 */
const main = async () => {
  const command = process.argv[2] || 'up';
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('MONGO_URI non définie dans l\'environnement');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri, {
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    console.log(`[Migrate] Connecté à MongoDB`);

    switch (command) {
      case 'up':
        await runMigrations(client);
        break;
      case 'down':
        await rollbackLastMigration(client);
        break;
      case 'status':
        await showStatus(client);
        break;
      default:
        console.error(`Commande inconnue: ${command}`);
        console.log('Usage: node scripts/migrations/migrate.js [up|down|status]');
        process.exit(1);
    }
  } finally {
    await client.close();
    console.log('[Migrate] Déconnecté');
  }
};

main().catch((error) => {
  console.error('[Migrate] Erreur:', error.message);
  process.exit(1);
});
