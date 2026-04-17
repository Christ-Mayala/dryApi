const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const LOG_DIR = path.join(ROOT, 'logs');

const getArg = (name, fallback = null) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
};

const suite = getArg('--suite', 'integration');
const appFilter = getArg('--app');
const featureFilter = getArg('--feature');
const strict = process.argv.includes('--strict');

const suiteDirectories = {
  unit: path.join(ROOT, 'tests', 'unit'),
  integration: path.join(ROOT, 'tests', 'integration'),
  e2e: path.join(ROOT, 'tests', 'e2e'),
  all: path.join(ROOT, 'tests'),
};

const selectedDirectory = suiteDirectories[suite];
if (!selectedDirectory) {
  console.error(`Suite inconnue: ${suite}`);
  process.exit(1);
}

const collectTestFiles = (directory, files = []) => {
  if (!fs.existsSync(directory)) return files;

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, files);
    } else if (entry.name.endsWith('.test.js')) {
      files.push(path.relative(ROOT, fullPath).replace(/\\/g, '/'));
    }
  }

  return files;
};

const filterTestFiles = (files) => {
  return files.filter((file) => {
    if (suite === 'unit') return true;
    if (appFilter && !file.toLowerCase().includes(`/${appFilter.toLowerCase()}/`)) return false;
    if (featureFilter && !file.toLowerCase().endsWith(`/${featureFilter.toLowerCase()}.test.js`))
      return false;
    return true;
  });
};

const ensureLogDirectory = () => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
};

const runNodeTests = (files) => {
  if (files.length === 0) {
    console.warn(`[tests] Aucun fichier trouve pour la suite "${suite}".`);
    return { status: 0, stdout: '', stderr: '' };
  }

  const args = ['--test', ...files];
  const env = { ...process.env };
  if (!env.SERVER_URL && env.SERVER_URL_TEST) {
    env.SERVER_URL = env.SERVER_URL_TEST;
  }
  if (strict) env.TEST_STRICT = 'true';

  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
};

const main = () => {
  const files = filterTestFiles(collectTestFiles(selectedDirectory));
  ensureLogDirectory();

  const result = runNodeTests(files);
  fs.writeFileSync(
    path.join(LOG_DIR, 'test-results.log'),
    `${result.stdout || ''}\n${result.stderr || ''}`,
    'utf8'
  );

  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');

  if (result.error) {
    console.error(`[tests] Echec du runner: ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  console.log(`[tests] Suite "${suite}" executee avec ${files.length} fichier(s).`);
};

main();
