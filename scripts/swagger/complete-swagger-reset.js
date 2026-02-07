const fs = require('fs');
const path = require('path');

console.log('?? RESET SWAGGER (mode propre)...\n');

// Étape 1: Suppression des anciens commentaires Swagger
console.log('1?? Suppression des anciens commentaires Swagger...');
try {
  const clean = path.join(__dirname, 'force-clean-swagger.js');
  if (fs.existsSync(clean)) {
    require('./force-clean-swagger.js');
  } else {
    console.log('?? Script force-clean-swagger.js introuvable');
  }
} catch (error) {
  console.log('? Erreur nettoyage:', error.message);
}

// Étape 2: Regénération Swagger
console.log('\n2?? Regénération Swagger...');
try {
  const regen = path.join(__dirname, 'generate-swagger-from-structure.js');
  if (fs.existsSync(regen)) {
    require('./generate-swagger-from-structure.js');
  } else {
    console.log('?? Script generate-swagger-from-structure.js introuvable');
  }
} catch (error) {
  console.log('? Erreur génération:', error.message);
}

// Étape 3: Nettoyage des doubles slashes
console.log('\n3?? Nettoyage des doublons dans les routes...');
try {
  const cleanup = path.join(__dirname, 'final-cleanup.js');
  if (fs.existsSync(cleanup)) {
    require('./final-cleanup.js');
  } else {
    console.log('?? Script final-cleanup.js introuvable');
  }
} catch (error) {
  console.log('? Erreur nettoyage:', error.message);
}

// Étape 4: Vérification des fichiers de routes (structure DRY)
console.log('\n4?? Vérification des fichiers de routes...');
const dryAppPath = path.join(__dirname, '../dryApp');
const dryModulesPath = path.join(__dirname, '../dry/modules');

const checkAppRoutes = () => {
  if (!fs.existsSync(dryAppPath)) return 0;
  let count = 0;
  const apps = fs.readdirSync(dryAppPath).filter((a) => !a.startsWith('.'));
  apps.forEach((app) => {
    const featuresPath = path.join(dryAppPath, app, 'features');
    if (!fs.existsSync(featuresPath)) return;
    const features = fs.readdirSync(featuresPath).filter((f) => !f.startsWith('.'));
    features.forEach((feature) => {
      const routePath = path.join(featuresPath, feature, 'route');
      if (fs.existsSync(routePath)) {
        const files = fs.readdirSync(routePath).filter((f) => f.endsWith('.routes.js'));
        count += files.length;
      }
    });
  });
  return count;
};

const checkModuleRoutes = () => {
  if (!fs.existsSync(dryModulesPath)) return 0;
  let count = 0;
  const mods = fs.readdirSync(dryModulesPath).filter((m) => !m.startsWith('.'));
  mods.forEach((m) => {
    const p = path.join(dryModulesPath, m);
    if (!fs.statSync(p).isDirectory()) return;
    const files = fs.readdirSync(p).filter((f) => f.endsWith('.routes.js'));
    count += files.length;
  });
  return count;
};

const appCount = checkAppRoutes();
const modCount = checkModuleRoutes();
console.log(`?? dryApp: ${appCount} fichiers .routes.js`);
console.log(`?? dry/modules: ${modCount} fichiers .routes.js`);

// Étape 5: Liens de documentation
console.log('\n5?? Liens de documentation:');
console.log('?? Documentation Swagger: http://localhost:5000/api-docs');
console.log('?? JSON Specs: http://localhost:5000/api-docs.json');

console.log('\n? RESET SWAGGER TERMINÉ !');
console.log('\n?? Prochaines étapes:');
console.log('1. Redémarre le serveur: npm run dev');
console.log('2. Vérifie la documentation: npm run swagger:docs');
console.log('3. Teste les endpoints via Swagger UI');
