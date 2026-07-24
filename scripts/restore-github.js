#!/usr/bin/env node

/**
 * Script de Restauration MongoDB ← GitHub Releases
 *
 * Télécharge un backup depuis GitHub Releases et le restaure dans MongoDB.
 * Peut aussi restaurer un fichier local (.gz).
 *
 * Prérequis :
 *   1. GITHUB_TOKEN dans .env (Personal Access Token avec scope "repo")
 *      → https://github.com/settings/tokens
 *   2. mongorestore installé
 *
 * Utilisation :
 *   npm run restore:github               # Menu interactif (liste les releases)
 *   npm run restore:github -- --latest   # Restaure le backup le plus récent
 *   npm run restore:github -- --file backups/mon_fichier.gz  # Fichier local
 *   npm run restore:github -- --release backups-2024-01-15   # Release spécifique
 *
 * ATTENTION : La restauration ÉCRASE la base de données actuelle !
 *   Une confirmation est demandée avant d'exécuter la restauration.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

// ==============================
// Configuration
// ==============================

const BACKUP_DIR = path.join(__dirname, '../backups');
const GITHUB_API = 'https://api.github.com';

// ==============================
// Détection du repo GitHub
// ==============================

const detectGitHubRepo = () => {
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remote.match(/(?:github\.com[/:])([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch { /* pas de remote */ }
  return null;
};

const GITHUB_REPO = process.env.GITHUB_REPO || detectGitHubRepo();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ==============================
// Utilitaires
// ==============================

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatDate = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const getAxiosHeaders = () => ({
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
});

// ==============================
// Déchiffrement AES-256
// ==============================

const decryptBackup = (encryptedPath) => {
  const backupKey = process.env.BACKUP_KEY;
  if (!backupKey) {
    throw new Error('BACKUP_KEY manquant dans .env — le backup est chiffré, définissez BACKUP_KEY pour le déchiffrer');
  }

  const decryptedPath = encryptedPath.replace(/\.enc$/, '');
  console.log(`\n[Restore] 🔓 Déchiffrement AES-256...`);

  execSync(
    `openssl enc -d -aes-256-cbc -pbkdf2 -in "${encryptedPath}" -out "${decryptedPath}" -pass pass:"${backupKey}"`,
    { stdio: 'inherit', timeout: 300000 }
  );

  fs.unlinkSync(encryptedPath);
  console.log(`[Restore] ✅ Déchiffré: ${path.basename(decryptedPath)}`);
  return decryptedPath;
};

// ==============================
// Interface interactive
// ==============================

const prompt = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

const confirmRestore = async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   ⚠️  ATTENTION : Action irréversible !         ║');
  console.log('║   La restauration va ÉCRASER les données        ║');
  console.log('║   actuelles de MongoDB.                         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const answer = await prompt('Tapez "RESTAURER" pour confirmer (ou Entrée pour annuler) : ');
  if (answer !== 'RESTAURER') {
    console.log('\n❌ Restauration annulée.');
    process.exit(0);
  }
};

// ==============================
// Récupération des releases GitHub
// ==============================

const fetchReleases = async () => {
  try {
    const { data } = await axios.get(
      `${GITHUB_API}/repos/${GITHUB_REPO}/releases?per_page=100`,
      { headers: getAxiosHeaders() }
    );
    // Filtrer uniquement les releases de backup
    return data.filter((r) => r.tag_name.startsWith('backups-'));
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) throw new Error('Token GitHub invalide. Créez-en un sur https://github.com/settings/tokens');
    if (status === 404) throw new Error(`Repo "${GITHUB_REPO}" introuvable. Vérifiez GITHUB_REPO.`);
    throw new Error(`GitHub API: ${err.response?.data?.message || err.message}`);
  }
};

const downloadAsset = async (asset, destPath) => {
  console.log(`\n[Restore] ⬇️ Téléchargement de ${asset.name} (${formatSize(asset.size)})...`);

  const writer = fs.createWriteStream(destPath);

  try {
    const response = await axios({
      url: asset.url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        ...getAxiosHeaders(),
        Accept: 'application/octet-stream',
      },
    });

    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[Restore] ✅ Téléchargé vers ${destPath}`);
    return destPath;
  } catch (err) {
    writer.destroy();
    try { fs.unlinkSync(destPath); } catch { /* fichier peut ne pas exister */ }
    throw new Error(`Échec du téléchargement: ${err.message}`);
  }
};

// ==============================
// Restauration MongoDB
// ==============================

const restoreMongoDB = (backupPath) => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI non définie dans .env');

  const stats = fs.statSync(backupPath);
  console.log(`\n[Restore] 🔄 Restauration MongoDB en cours...`);
  console.log(`[Restore] 📦 Fichier: ${path.basename(backupPath)} (${formatSize(stats.size)})`);
  console.log(`[Restore] 🎯 URI: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);

  const restoreCommand = `mongorestore --uri="${mongoUri}" --archive="${backupPath}" --gzip --drop`;
  execSync(restoreCommand, {
    stdio: 'inherit',
    timeout: 600000, // 10 minutes max
  });

  console.log('\n[Restore] ✅ Restauration terminée avec succès !');
};

// ==============================
// Menu de sélection interactif
// ==============================

const showInteractiveMenu = async (releases) => {
  if (releases.length === 0) {
    console.log('\n❌ Aucun backup disponible sur GitHub Releases.');
    console.log('💡 Faites d\'abord: npm run backup:github');
    process.exit(1);
  }

  console.log('\n📋 Backups disponibles sur GitHub Releases :\n');

  // Aplatir tous les assets de toutes les releases
  const options = [];
  for (const release of releases) {
    const releaseDate = formatDate(release.created_at);
    for (const asset of release.assets) {
      options.push({
        releaseTag: release.tag_name,
        asset,
        label: `${options.length + 1}. ${asset.name}`,
        date: releaseDate,
      });
    }
  }

  // Trier du plus récent au plus ancien
  options.sort((a, b) => new Date(b.asset.created_at) - new Date(a.asset.created_at));

  options.forEach((opt, i) => {
    const num = (i + 1).toString().padStart(2, ' ');
    console.log(`  ${num}. ${opt.asset.name}`);
    console.log(`      📅 ${opt.date}  │  💾 ${formatSize(opt.asset.size)}  │  🏷️  ${opt.releaseTag}`);
    console.log('');
  });

  const choice = await prompt(`Choisissez un backup à restaurer (1-${options.length}) : `);
  const index = parseInt(choice, 10) - 1;

  if (isNaN(index) || index < 0 || index >= options.length) {
    console.log('\n❌ Choix invalide.');
    process.exit(1);
  }

  return options[index];
};

// ==============================
// Restauration depuis un fichier local
// ==============================

const restoreFromLocalFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  const ext = path.extname(filePath);
  if (ext !== '.gz' && ext !== '.enc') {
    console.warn(`\n⚠️  Extension inhabituelle: ${ext}. Attendu: .gz ou .enc`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error('Le fichier est vide');
  }

  // Déchiffrer si le fichier est chiffré
  if (ext === '.enc') {
    return decryptBackup(filePath);
  }

  return filePath;
};

// ==============================
// Pré-vérifications
// ==============================

const preflightChecks = (needsGitHub) => {
  const issues = [];

  if (!process.env.MONGO_URI) {
    issues.push('MONGO_URI non définie dans .env');
  }

  if (needsGitHub) {
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
  }

  // Vérifier que mongorestore est installé
  try {
    execSync('mongorestore --version', { stdio: 'pipe' });
  } catch {
    issues.push([
      'mongorestore n\'est pas installé.',
      '→ Installez MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools',
    ].join('\n'));
  }

  if (issues.length > 0) {
    console.error('❌ Pré-requis manquants :\n');
    issues.forEach((i) => console.error(`  • ${i}`));
    if (needsGitHub) {
      console.error('\n💡 Un token GitHub est nécessaire : https://github.com/settings/tokens');
    }
    process.exit(1);
  }
};

// ==============================
// Affichage du mode d'emploi
// ==============================

const showHelp = () => {
  console.log(`
📖  RESTORE-GITHUB — Manuel d'utilisation

  Restaure une base MongoDB depuis un backup GitHub Releases.

COMMANDES :
  npm run restore:github                    Menu interactif
  npm run restore:github -- --latest        Dernier backup disponible
  npm run restore:github -- --file <chemin> Fichier local (.gz)
  npm run restore:github -- --release <tag> Release spécifique

EXEMPLES :
  npm run restore:github -- --latest
  npm run restore:github -- --file backups/dryapi_2024-01-15_1234.gz
  npm run restore:github -- --release backups-2024-01-15

⚠️  ATTENTION : La restauration ÉCRASE toutes les données actuelles !
  Une confirmation "RESTAURER" vous sera demandée.

PRÉREQUIS :
  - GITHUB_TOKEN dans .env
  - mongorestore installé sur la machine
`);
};

// ==============================
// Point d'entrée principal
// ==============================

const main = async () => {
  const args = process.argv.slice(2);

  // Aide
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║    Restauration MongoDB ← GitHub      ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');

  // Déterminer la source du backup
  const fileArgIndex = args.indexOf('--file');
  const releaseArgIndex = args.indexOf('--release');
  const isLatest = args.includes('--latest');
  const needsGitHub = !(fileArgIndex !== -1 && args[fileArgIndex + 1]);

  // Pré-vérifications
  console.log('[1/4] 🔎 Vérification de la configuration...');
  preflightChecks(needsGitHub);
  if (needsGitHub) {
    console.log(`[1/4] ✅ Repo: ${GITHUB_REPO}`);
  } else {
    console.log(`[1/4] ✅ Mode fichier local`);
  }

  let backupFile = null;

  if (fileArgIndex !== -1 && args[fileArgIndex + 1]) {
    // --- RESTAURATION DEPUIS UN FICHIER LOCAL ---
    const localPath = path.resolve(args[fileArgIndex + 1]);
    console.log(`\n[2/4] 📂 Backup local: ${localPath}`);
    backupFile = restoreFromLocalFile(localPath);
    console.log(`[2/4] ✅ Fichier valide: ${formatSize(fs.statSync(backupFile).size)}`);

  } else {
    // --- RESTAURATION DEPUIS GITHUB ---
    console.log('\n[2/4] 📦 Récupération des releases GitHub...');
    const releases = await fetchReleases();

    if (releases.length === 0) {
      console.log('❌ Aucun backup trouvé sur GitHub Releases.');
      console.log('💡 Faites d\'abord: npm run backup:github');
      process.exit(1);
    }

    console.log(`[2/4] ✅ ${releases.length} release(s) trouvée(s)`);

    let selected;

    if (isLatest) {
      // Prendre le dernier asset du release le plus récent
      const latestRelease = releases[0];
      if (!latestRelease.assets || latestRelease.assets.length === 0) {
        console.log(`❌ Le release ${latestRelease.tag_name} n'a pas d'assets.`);
        process.exit(1);
      }
      selected = {
        releaseTag: latestRelease.tag_name,
        asset: latestRelease.assets[0],
        label: latestRelease.assets[0].name,
      };
      console.log(`\n[3/4] ⬇️ Dernier backup: ${selected.asset.name} (${formatDate(latestRelease.created_at)})`);

    } else if (releaseArgIndex !== -1 && args[releaseArgIndex + 1]) {
      // Release spécifique
      const tag = args[releaseArgIndex + 1];
      const release = releases.find((r) => r.tag_name === tag);
      if (!release) {
        console.log(`❌ Release "${tag}" introuvable.`);
        console.log('💡 Releases disponibles :');
        releases.forEach((r) => console.log(`   - ${r.tag_name}`));
        process.exit(1);
      }
      if (!release.assets || release.assets.length === 0) {
        console.log(`❌ Le release ${tag} n'a pas d'assets.`);
        process.exit(1);
      }
      selected = {
        releaseTag: release.tag_name,
        asset: release.assets[0],
        label: release.assets[0].name,
      };
      console.log(`\n[3/4] ⬇️ Backup: ${selected.asset.name} (${formatDate(release.created_at)})`);

    } else {
      // Menu interactif
      selected = await showInteractiveMenu(releases);
      console.log(`\n[3/4] ✅ Sélectionné: ${selected.asset.name}`);
    }

    // Télécharger l'asset
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    backupFile = path.join(BACKUP_DIR, selected.asset.name);
    await downloadAsset(selected.asset, backupFile);

    // Déchiffrer si le fichier téléchargé est chiffré (.enc)
    if (selected.asset.name.endsWith('.enc')) {
      backupFile = decryptBackup(backupFile);
    }
  }

  // Confirmation
  console.log('\n[3/4] ⚠️  Demande de confirmation...');
  await confirmRestore();

  // Restauration MongoDB
  console.log('\n[4/4] 🔄 Exécution de la restauration...');
  restoreMongoDB(backupFile);

  // Résumé
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║      ✅  Restauration terminée !      ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');
  console.log(`  📦 Fichier : ${path.basename(backupFile)}`);
  console.log(`  🎯 Base    : ${process.env.MONGO_URI?.replace(/\/\/.*@/, '//***@') || 'MONGO_URI'}`);
  console.log('');
};

main().catch((err) => {
  console.error(`\n❌ ERREUR: ${err.message}\n`);
  process.exit(1);
});
