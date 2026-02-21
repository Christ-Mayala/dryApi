
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('📦 Installateur DRY NATIVE pour SkillForge');
console.log('Ce script installe le client directement dans votre architecture @dry/sdk ou features.');

const defaultPath = path.resolve(__dirname, '../../../../../dryApp/src/app/features/skillforge');

rl.question(`Chemin d'installation (par defaut: ${defaultPath}) : `, (targetDir) => {
  const dest = targetDir.trim() || defaultPath;

  if (!fs.existsSync(dest)) {
    console.log(`Création du dossier: ${dest}`);
    fs.mkdirSync(dest, { recursive: true });
  }

  const src = __dirname;
  
  // Copy models
  const destModels = path.join(dest, 'models');
  if (!fs.existsSync(destModels)) fs.mkdirSync(destModels, { recursive: true });
  fs.readdirSync(path.join(src, 'models')).forEach(f => {
    fs.copyFileSync(path.join(src, 'models', f), path.join(destModels, f));
  });

  // Copy services
  const destServices = path.join(dest, 'services');
  if (!fs.existsSync(destServices)) fs.mkdirSync(destServices, { recursive: true });
  fs.readdirSync(path.join(src, 'services')).forEach(f => {
    fs.copyFileSync(path.join(src, 'services', f), path.join(destServices, f));
  });

  // Copy index
  fs.copyFileSync(path.join(src, 'index.ts'), path.join(dest, 'index.ts'));

  console.log('\n🎉 Installation terminée !');
  console.log(`✅ Client installé dans : ${dest}`);
  console.log('👉 Vous pouvez maintenant importer les services directement.');
  rl.close();
});
