#!/usr/bin/env node

/**
 * Script de Sauvegarde MongoDB → GitHub Releases
 * 
 * Crée un backup compressé de MongoDB et l'uploade automatiquement
 * vers GitHub Releases (stockage illimité pour les repos publics).
 * 
 * Prérequis :
 *   1. GITHUB_TOKEN dans .env (Personal Access Token avec scope "repo")
 *      → Créer ici : https://github.com/settings/tokens
 *   2. mongodump installé
 * 
 * Utilisation :
 *   npm run backup:github
 * 
 * Variables d'environnement (optionnelles) :
 *   GITHUB_REPO       - ex: "username/repo" (auto-détecté depuis git remote)
 *   GITHUB_TOKEN      - Token GitHub avec scope repo
 *   BACKUP_RETENTION  - Jours de rétention locale (défaut: 30)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const axios = require('axios');

// ==============================
// Configuration
// ==============================

const BACKUP_DIR = path.join(__dirname, '../backups');
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION) || 30;

// ==============================
// Détection du repo GitHub
// ==============================

const detectGitHubRepo = () => {
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    // Supporte: https://github.com/user/repo.git  et  git@github.com:user/repo.git
    const match = remote.match(/(?:github\.com[/:])([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {
    // pas de remote
  }
  return null;
};

const GITHUB_REPO = process.env.GITHUB_REPO || detectGitHubRepo();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ==============================
// Utilitaires
// ==============================

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[Backup] Dossier créé: ${BACKUP_DIR}`);
  }
};

const getBackupFilename = () => {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();
  const dbName = new URL(process.env.MONGO_URI || '').pathname?.replace('/', '') || 'dryapi';
  return `${dbName}_${date}_${timestamp}.gz`;
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

// ==============================
// Backup MongoDB
// ==============================

const createBackup = (outputPath) => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI non définie dans .env');
  }

  console.log(`[Backup] 🔄 Sauvegarde MongoDB en cours...`);
  const dumpCommand = `mongodump --uri="${mongoUri}" --archive --gzip`;
  execSync(dumpCommand, {
    stdio: ['pipe', fs.openSync(outputPath, 'w'), 'pipe'],
    timeout: 300000, // 5 minutes max
  });

  const stats = fs.statSync(outputPath);
  const size = formatSize(stats.size);
  console.log(`[Backup] ✅ Sauvegarde créée: ${path.basename(outputPath)} (${size})`);
  return stats.size;
};

// ==============================
// Vérification d'intégrité
// ==============================

const verifyBackup = (backupPath) => {
  console.log('[Backup] 🔍 Vérification du fichier...');
  const stats = fs.statSync(backupPath);

  if (stats.size === 0) {
    throw new Error('Fichier de backup vide');
  }

  const buffer = fs.readFileSync(backupPath);
  try {
    const decompressed = zlib.gunzipSync(buffer);
    const content = decompressed.toString('utf8', 0, Math.min(decompressed.length, 100));
    if (!content.includes('{')) {
      throw new Error('Format de backup invalide');
    }
  } catch (e) {
    if (e.message === 'Format de backup invalide') throw e;
    throw new Error('Fichier compressé invalide');
  }

  console.log(`[Backup] ✅ Intégrité vérifiée: ${formatSize(stats.size)}`);
};

// ==============================
// Nettoyage des vieux backups
// ==============================

const cleanupOldBackups = () => {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  const files = fs.readdirSync(BACKUP_DIR);
  for (const file of files) {
    if (file === '.gitkeep') continue;
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`[Backup] 🧹 ${deletedCount} ancien(s) backup(s) supprimés (rétention: ${RETENTION_DAYS}j)`);
  }
};

// ==============================
// Upload vers GitHub Releases
// ==============================

const GITHUB_API = 'https://api.github.com';

const getAxiosHeaders = () => ({
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
});

const findOrCreateRelease = async (repo) => {
  const tag = `backups-${new Date().toISOString().split('T')[0]}`;

  // Vérifier si un release avec ce tag existe déjà
  try {
    const { data } = await axios.get(`${GITHUB_API}/repos/${repo}/releases/tags/${tag}`, {
      headers: getAxiosHeaders(),
    });
    console.log(`[GitHub] 📦 Release existante: ${data.name}`);
    return data;
  } catch {
    // Release n'existe pas, on la crée
  }

  try {
    const { data } = await axios.post(
      `${GITHUB_API}/repos/${repo}/releases`,
      {
        tag_name: tag,
        name: `🗄️ Backup MongoDB - ${tag}`,
        body: [
          `## Backup automatique MongoDB`,
          ``,
          `- **Date :** ${new Date().toLocaleString('fr-FR')}`,
          `- **Base :** ${(new URL(process.env.MONGO_URI || '').pathname?.replace('/', '')) || 'dryapi'}`,
          `- **Rétention :** ${RETENTION_DAYS} jours`,
          ``,
          `> _Généré automatiquement par le script de backup_`,
        ].join('\n'),
        prerelease: false,
      },
      { headers: getAxiosHeaders() }
    );
    console.log(`[GitHub] 📦 Release créée: ${data.html_url}`);
    return data;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    throw new Error(`GitHub API (création release): ${status} — ${msg}`);
  }
};

const uploadAsset = async (release, filePath) => {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  console.log(`[GitHub] ⬆️ Upload de ${fileName} (${formatSize(fileSize)})...`);

  const fileStream = fs.createReadStream(filePath);

  // Vérifier si l'asset existe déjà → le supprimer
  if (release.assets?.length > 0) {
    const existing = release.assets.find((a) => a.name === fileName);
    if (existing) {
      console.log(`[GitHub] 🗑️ Asset existant trouvé, suppression...`);
      await axios.delete(`${GITHUB_API}/repos/${GITHUB_REPO}/releases/assets/${existing.id}`, {
        headers: getAxiosHeaders(),
      });
    }
  }

  try {
    const { data } = await axios.post(
      `https://uploads.github.com/repos/${GITHUB_REPO}/releases/${release.id}/assets?name=${encodeURIComponent(fileName)}`,
      fileStream,
      {
        headers: {
          ...getAxiosHeaders(),
          'Content-Type': 'application/gzip',
          'Content-Length': fileSize,
        },
        maxContentLength: 500 * 1024 * 1024, // 500 MB max
        maxBodyLength: 500 * 1024 * 1024,
      }
    );
    console.log(`[GitHub] ✅ Upload terminé: ${data.browser_download_url}`);
    return data;
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    throw new Error(`GitHub API (upload asset): ${status} — ${msg}`);
  }
};

// ==============================
// Nettoyage des vieux releases
// ==============================

const cleanupOldReleases = async (repo) => {
  const cutoffDays = RETENTION_DAYS;
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);

  try {
    const { data: allReleases } = await axios.get(
      `${GITHUB_API}/repos/${repo}/releases?per_page=100`,
      { headers: getAxiosHeaders() }
    );

    const backupReleases = allReleases.filter((r) => r.tag_name.startsWith('backups-'));
    let deletedCount = 0;

    for (const release of backupReleases) {
      const releaseDate = new Date(release.created_at);
      if (releaseDate < cutoff) {
        console.log(`[GitHub] 🗑️ Suppression du vieux release: ${release.tag_name}`);
        await axios.delete(`${GITHUB_API}/repos/${repo}/releases/${release.id}`, {
          headers: getAxiosHeaders(),
        });
        // Supprimer aussi le tag
        try {
          await axios.delete(`${GITHUB_API}/repos/${repo}/git/refs/tags/${release.tag_name}`, {
            headers: getAxiosHeaders(),
          });
        } catch {
          // tag peut déjà être supprimé
        }
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[GitHub] 🧹 ${deletedCount} vieux release(s) GitHub supprimés (rétention: ${RETENTION_DAYS}j)`);
    }
  } catch (err) {
    console.error(`[GitHub] ⚠️ Erreur nettoyage releases: ${err.message}`);
  }
};

// ==============================
// Pré-vérifications
// ==============================

const preflightChecks = async () => {
  const issues = [];

  if (!process.env.MONGO_URI) {
    issues.push('MONGO_URI non définie dans .env');
  }

  if (!GITHUB_TOKEN) {
    issues.push('GITHUB_TOKEN non défini dans .env');
  }

  if (!GITHUB_REPO) {
    issues.push([
      'Impossible de détecter le repo GitHub.',
      '→ Définissez GITHUB_REPO dans .env (ex: GITHUB_REPO=username/repo)',
      '→ Ou assurez-vous que git remote origin pointe vers GitHub',
    ].join('\n'));
  }

  if (issues.length > 0) {
    console.error('❌ Pré-requis manquants :\n');
    issues.forEach((i) => console.error(`  • ${i}`));
    console.error('\n💡 Pour créer un token GitHub : https://github.com/settings/tokens');
    process.exit(1);
  }

  // Tester le token
  try {
    await axios.get(`${GITHUB_API}/repos/${GITHUB_REPO}`, {
      headers: getAxiosHeaders(),
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) {
      console.error('❌ Token GitHub invalide ou révoqué.');
      console.error('💡 Créez un nouveau token : https://github.com/settings/tokens');
      process.exit(1);
    }
    if (status === 404) {
      console.error(`❌ Repo "${GITHUB_REPO}" introuvable.`);
      console.error('💡 Vérifiez GITHUB_REPO ou les permissions du token.');
      process.exit(1);
    }
    throw err;
  }
};

// ==============================
// Point d'entrée principal
// ==============================

const main = async () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║    Backup MongoDB → GitHub Releases    ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');

  // 1. Pré-vérifications
  console.log('[1/6] 🔎 Vérification de la configuration...');
  await preflightChecks();
  console.log(`[1/6] ✅ Repo: ${GITHUB_REPO}`);

  // 2. Créer le dossier backups
  console.log('\n[2/6] 📁 Préparation du dossier...');
  ensureBackupDir();

  // 3. Créer le backup
  console.log('\n[3/6] 💾 Création du backup MongoDB...');
  const filename = getBackupFilename();
  const backupPath = path.join(BACKUP_DIR, filename);
  const fileSize = createBackup(backupPath);

  // 4. Vérifier l'intégrité
  console.log('\n[4/6] 🔍 Vérification de l\'intégrité...');
  verifyBackup(backupPath);

  // 5. Upload vers GitHub
  console.log('\n[5/6] ⬆️ Upload vers GitHub Releases...');
  const release = await findOrCreateRelease(GITHUB_REPO);
  await uploadAsset(release, backupPath);

  // 6. Nettoyage
  console.log('\n[6/6] 🧹 Nettoyage...');
  cleanupOldBackups();
  await cleanupOldReleases(GITHUB_REPO);

  // Résumé final
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║         ✅  Backup terminé !           ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`  📦 Fichier : ${filename}`);
  console.log(`  💾 Taille   : ${formatSize(fileSize)}`);
  console.log(`  🔗 Release  : https://github.com/${GITHUB_REPO}/releases`);
  console.log('');
};

main().catch((err) => {
  console.error(`\n❌ ERREUR: ${err.message}\n`);
  process.exit(1);
});
