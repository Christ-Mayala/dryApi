const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');

if (!fs.existsSync(TESTS_DIR)) {
  console.log('Aucun dossier tests.');
  process.exit(0);
}

const apps = fs.readdirSync(TESTS_DIR).filter((d) => {
  const p = path.join(TESTS_DIR, d);
  return fs.statSync(p).isDirectory() && !d.startsWith('_') && d !== 'validation';
});

console.log('TESTS PAR APPLICATION');
console.log('----------------------');
apps.forEach((app) => {
  const appDir = path.join(TESTS_DIR, app);
  const files = fs.readdirSync(appDir).filter((f) => f.endsWith('.test.js'));
  console.log(`- ${app}: ${files.length} fichiers`);
  files.forEach((f) => console.log(`  * ${f.replace('.test.js', '')}`));
});

const validationDir = path.join(TESTS_DIR, 'validation');
if (fs.existsSync(validationDir)) {
  const files = fs.readdirSync(validationDir).filter((f) => f.endsWith('.test.js'));
  console.log('\nTESTS VALIDATION');
  console.log('----------------');
  files.forEach((f) => console.log(`- ${f.replace('.test.js', '')}`));
}
