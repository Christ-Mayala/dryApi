#!/usr/bin/env node

/**
 * Script de Sauvegarde Automatisée MongoDB
 * Sauvegarde quotidienne avec compression, rotation et notification
 * @module scripts/backup
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const pipeline = promisify(require('stream').pipeline);

const BACKUP_DIR = path.join(__dirname, '../backups');
const RETENTION_DAYS = 30;

/**
 * Crée le dossier de backup s'il n'existe pas
 */
const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[Backup] Dossier créé: ${BACKUP_DIR}`);
  }
};

/**
 * Génère le nom du fichier de backup
 * @returns {string} Nom du fichier
 */
const getBackupFilename = () => {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();
  const dbName = new URL(process.env.MONGO_URI || '').pathname?.replace('/', '') || 'dryapi';
  return `${dbName}_${date}_${timestamp}.gz`;
};

/**
 * Exécute la sauvegarde MongoDB avec mongodump et compression
 * @returns {Promise<string>} Chemin du fichier de backup
 */
const runBackup = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI non définie');
  }

  const filename = getBackupFilename();
  const outputPath = path.join(BACKUP_DIR, filename);

  console.log(`[Backup] Début de la sauvegarde vers ${filename}`);

  // Exécuter mongodump et compresser
  const dumpCommand = `mongodump --uri="${mongoUri}" --archive --gzip`;
  execSync(dumpCommand, {
    stdio: ['pipe', fs.openSync(outputPath, 'w'), 'pipe'],
    timeout: 300000, // 5 minutes max
  });

  // Vérifier la taille du fichier
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`[Backup] ✓ Sauvegarde terminée: ${filename} (${sizeMB} MB)`);

  return outputPath;
};

/**
 * Nettoie les vieux backups selon la politique de rétention
 */
const cleanupOldBackups = () => {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  const files = fs.readdirSync(BACKUP_DIR);
  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`[Backup] Nettoyage: ${file} supprimé`);
    }
  }

  if (deletedCount > 0) {
    console.log(`[Backup] ${deletedCount} ancien(s) backup(s) supprimé(s)`);
  }
};

/**
 * Vérifie l'intégrité du backup
 * @param {string} backupPath - Chemin du fichier de backup
 * @returns {Promise<boolean>} true si le backup est valide
 */
const verifyBackup = async (backupPath) => {
  try {
    console.log('[Backup] Vérification du backup...');
    const stats = fs.statSync(backupPath);

    // Vérifier que le fichier n'est pas vide
    if (stats.size === 0) {
      console.error('[Backup] ✗ Fichier de backup vide');
      return false;
    }

    // Vérifier que c'est un fichier gzip valide
    const buffer = fs.readFileSync(backupPath);
    try {
      const decompressed = zlib.gunzipSync(buffer);
      // Vérifier qu'il contient des données JSON (BSON archive)
      const content = decompressed.toString('utf8', 0, Math.min(decompressed.length, 100));
      if (!content.includes('{')) {
        console.error('[Backup] ✗ Format de backup invalide');
        return false;
      }
    } catch {
      console.error('[Backup] ✗ Fichier compressé invalide');
      return false;
    }

    console.log(`[Backup] ✓ Backup vérifié: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    return true;
  } catch (error) {
    console.error(`[Backup] ✗ Erreur de vérification: ${error.message}`);
    return false;
  }
};

/**
 * Envoie une notification de backup (console pour l'instant)
 * @param {boolean} success - Succès du backup
 * @param {object} details - Détails du backup
 */
const sendNotification = (success, details) => {
  const status = success ? '✓ SUCCÈS' : '✗ ÉCHEC';
  const lines = [
    `=== Sauvegarde MongoDB: ${status} ===`,
    `Date: ${new Date().toISOString()}`,
    `Base: ${details.database}`,
  ];

  if (success) {
    lines.push(`Fichier: ${details.filename}`);
    lines.push(`Taille: ${details.sizeMB} MB`);
  } else {
    lines.push(`Erreur: ${details.error}`);
  }

  console.log(`\n${lines.join('\n')}\n`);
};

/**
 * Point d'entrée principal
 */
const main = async () => {
  console.log('=== Sauvegarde MongoDB ===\n');

  ensureBackupDir();
  cleanupOldBackups();

  try {
    const backupPath = await runBackup();
    const isValid = await verifyBackup(backupPath);

    const stats = fs.statSync(backupPath);
    const dbName = new URL(process.env.MONGO_URI || '').pathname?.replace('/', '') || 'dryapi';

    sendNotification(isValid, {
      database: dbName,
      filename: path.basename(backupPath),
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    });

    if (!isValid) {
      process.exit(1);
    }
  } catch (error) {
    sendNotification(false, {
      database: 'unknown',
      error: error.message,
    });
    process.exit(1);
  }
};

main();
