/**
 * Script d'inspection MongoDB
 * Affiche la taille des collections et le nombre de documents
 * pour chaque application (FreeLLM, SCIM, Pelerin, Trivida, etc.)
 *
 * Usage: node scripts/inspect-db.js
 *        MONGO_URI doit être défini dans .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getAppNames } = require('../dry/core/application/appScanner');
const { getTenantDB } = require('../dry/config/connection/dbConnection');

// ─── Formatage ──────────────────────────────────────────────────────────────

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
};

const padRight = (str, len) => String(str).padEnd(len);
const padLeft = (str, len) => String(str).padStart(len);

// ─── Collections ciblées par le nettoyage ───────────────────────────────────

const RETENTION_COLLECTIONS = new Set([
  'logs', 'auditlogs',
  'requests', 'conversations', 'conversationmessages',
  'messages', 'propertyviews',
  'habitlogs', 'meditationlogs',
  'activities', 'activityrecettes',
  'leadresponses',
]);

// ─── Fonctions ──────────────────────────────────────────────────────────────

const getCollectionStats = async (db) => {
  const collections = await db.db.listCollections().toArray();
  const stats = [];

  for (const col of collections) {
    try {
      const colStats = await db.db.command({ collStats: col.name });
      stats.push({
        name: col.name,
        count: colStats.count || 0,
        size: colStats.size || 0,
        storageSize: colStats.storageSize || 0,
        avgObjSize: colStats.avgObjSize || 0,
        hasNindexes: colStats.nindexes || 0,
        totalIndexSize: colStats.totalIndexSize || 0,
      });
    } catch (err) {
      stats.push({ name: col.name, count: -1, size: 0, storageSize: 0, error: err.message });
    }
  }

  // Trier par taille décroissante
  stats.sort((a, b) => (b.size || 0) - (a.size || 0));
  return stats;
};

const printAppHeader = (appName) => {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  📦 ${appName}`);
  console.log(`${'═'.repeat(70)}`);
};

const printTable = (stats) => {
  if (stats.length === 0) {
    console.log('  (aucune collection)');
    return;
  }

  console.log(`  ${padRight('Collection', 28)} ${padLeft('Docs', 10)} ${padLeft('Taille', 10)} ${padLeft('Stockage', 10)} ${padLeft('Index', 10)}`);
  console.log(`  ${'─'.repeat(68)}`);

  let totalDocs = 0;
  let totalSize = 0;
  let totalStorage = 0;
  let totalIndex = 0;
  let retentionDocs = 0;
  let retentionSize = 0;

  for (const s of stats) {
    const isRetention = RETENTION_COLLECTIONS.has(s.name);
    const marker = isRetention ? ' 🗑️' : '   ';

    if (isRetention) {
      retentionDocs += s.count || 0;
      retentionSize += s.size || 0;
    }

    totalDocs += s.count || 0;
    totalSize += s.size || 0;
    totalStorage += s.storageSize || 0;
    totalIndex += s.totalIndexSize || 0;

    const countStr = s.count >= 0 ? padLeft(s.count.toLocaleString('fr-FR'), 10) : padLeft('ERR', 10);
    console.log(
      `  ${padRight(s.name, 25)}${marker} ${countStr} ${padLeft(formatBytes(s.size), 10)} ${padLeft(formatBytes(s.storageSize), 10)} ${padLeft(formatBytes(s.totalIndexSize), 10)}`
    );
  }

  console.log(`  ${'─'.repeat(68)}`);
  console.log(`  ${padRight('TOTAL', 25)}   ${padLeft(totalDocs.toLocaleString('fr-FR'), 10)} ${padLeft(formatBytes(totalSize), 10)} ${padLeft(formatBytes(totalStorage), 10)} ${padLeft(formatBytes(totalIndex), 10)}`);
  console.log(`  ${padRight('→ Nettoyable 🗑️', 25)}   ${padLeft(retentionDocs.toLocaleString('fr-FR'), 10)} ${padLeft(formatBytes(retentionSize), 10)}`);
};

// ─── Main ───────────────────────────────────────────────────────────────────

const main = async () => {
  try {
    console.log('');
    console.log('  🔍 INSPECTION DE LA BASE DE DONNÉES');
    console.log('  ═══════════════════════════════════');
    console.log('');
    console.log(`  Connexion à MongoDB Atlas...`);

    // Connexion au cluster
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`  ✅ Connecté à : ${process.env.MONGO_URI?.replace(/\/\/.*@/, '//***@') || 'MONGO_URI'}`);

    // Stats de la base principale (dryapi)
    const uri = process.env.MONGO_URI || '';
    const mainDbName = uri ? new URL(uri).pathname?.replace('/', '') || 'dryapi' : 'dryapi';
    console.log(`\n  📊 Base principale : ${mainDbName}`);

    // Utiliser directement la connexion mongoose pour la base principale
    const mainDB = mongoose.connection.useDb(mainDbName);
    const mainStats = await getCollectionStats(mainDB);
    printAppHeader(`Base principale (${mainDbName})`);
    printTable(mainStats);

    // Stats par application (tenants)
    const apps = getAppNames();
    let grandTotalDocs = 0;
    let grandTotalSize = 0;
    let grandRetentionDocs = 0;
    let grandRetentionSize = 0;

    for (const appName of apps) {
      try {
        const db = getTenantDB(appName);
        const stats = await getCollectionStats(db);
        printAppHeader(appName);
        printTable(stats);

        // Cumul
        for (const s of stats) {
          grandTotalDocs += s.count || 0;
          grandTotalSize += s.size || 0;
          if (RETENTION_COLLECTIONS.has(s.name)) {
            grandRetentionDocs += s.count || 0;
            grandRetentionSize += s.size || 0;
          }
        }
      } catch (err) {
        console.log(`\n  ❌ ${appName} → Erreur: ${err.message}`);
      }
    }

    // Ajouter les stats de la base principale au grand total
    for (const s of mainStats) {
      grandTotalDocs += s.count || 0;
      grandTotalSize += s.size || 0;
      if (RETENTION_COLLECTIONS.has(s.name)) {
        grandRetentionDocs += s.count || 0;
        grandRetentionSize += s.size || 0;
      }
    }

    // Grand total
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  📊 RÉSUMÉ GLOBAL`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  Total documents      : ${grandTotalDocs.toLocaleString('fr-FR')}`);
    console.log(`  Taille totale         : ${formatBytes(grandTotalSize)}`);
    console.log(`  🗑️ Nettoyable (logs)  : ${grandRetentionDocs.toLocaleString('fr-FR')} documents`);
    console.log(`  🗑️ Taille nettoyable   : ${formatBytes(grandRetentionSize)}`);
    console.log(`\n  💡 Les collections marquées 🗑️ seront supprimées`);
    console.log(`     automatiquement chaque jour à 4h du matin.`);
    console.log('');

  } catch (err) {
    console.error(`\n  ❌ Erreur: ${err.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

main();
