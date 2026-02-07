#!/usr/bin/env node

/**
 * Backup MongoDB via mongodump.
 * Requiert l'outil mongodump installe sur la machine.
 */

require('dotenv').config();

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const uri = process.env.MONGO_URI || '';
const dbName = process.env.MONGO_DB_NAME || '';
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(__dirname, '..', 'backups', `mongo-${ts}`);

if (!uri) {
  console.error('[backup] MONGO_URI manquant');
  process.exit(1);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const args = [
  `--uri="${uri}"`,
  dbName ? `--db="${dbName}"` : '',
  `--out="${outDir}"`,
].filter(Boolean).join(' ');

try {
  execSync(`mongodump ${args}`, { stdio: 'inherit' });
  console.log(`[backup] OK -> ${outDir}`);
} catch (e) {
  console.error('[backup] ECHEC. Verifie que mongodump est installe.');
  process.exit(1);
}
