
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('📦 Installateur du client SkillForge');
console.log('Ce script va copier les fichiers du client vers votre projet frontend.');

rl.question('Chemin absolu vers votre dossier "src/app/services" ou equivalent : ', (targetDir) => {
  if (!targetDir) {
    console.log('❌ Chemin invalide');
    rl.close();
    return;
  }

  const dest = path.join(targetDir, 'skillforge-client');
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const src = __dirname;
  const files = ['index.ts', 'api.config.ts', 'skillforge.service.ts'];
  const modelsDir = path.join(src, 'models');
  
  // Copy root files
  files.forEach(f => {
    if (fs.existsSync(path.join(src, f))) {
      fs.copyFileSync(path.join(src, f), path.join(dest, f));
      console.log(`✅ Copié: ${f}`);
    }
  });

  // Copy models
  const destModels = path.join(dest, 'models');
  if (!fs.existsSync(destModels)) fs.mkdirSync(destModels);
  
  if (fs.existsSync(modelsDir)) {
    fs.readdirSync(modelsDir).forEach(f => {
      fs.copyFileSync(path.join(modelsDir, f), path.join(destModels, f));
      console.log(`✅ Copié: models/${f}`);
    });
  }

  console.log('\n🎉 Installation terminée !');
  console.log(`📂 Emplacement : ${dest}`);
  rl.close();
});
