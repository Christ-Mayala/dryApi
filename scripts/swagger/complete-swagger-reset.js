const fs = require('fs');
const path = require('path');

console.log('RESET SWAGGER GLOBAL...');

const dryAppPath = path.join(__dirname, '../../dryApp');
const dryModulesPath = path.join(__dirname, '../../dry/modules');

// 1. Appel du generateur simplifie
console.log('Regeneration des tags...');
try {
  // On utilise require pour lancer le script simple-swagger-generate.js
  require('./simple-swagger-generate.js');
} catch (error) {
  console.error('Erreur generation:', error.message);
}

// 2. Verification de la structure
const checkRoutes = (dir) => {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const walk = (d) => {
    const items = fs.readdirSync(d);
    items.forEach(item => {
      const p = path.join(d, item);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (item.endsWith('.routes.js')) count++;
    });
  };
  walk(dir);
  return count;
};

console.log(`✅ Apps: ${checkRoutes(dryAppPath)} fichiers de routes detectes.`);
console.log(`✅ Kernels: ${checkRoutes(dryModulesPath)} fichiers de routes detectes.`);
console.log('\n✨ Swagger est pret. Lancez "npm run dev" et rendez-vous sur http://localhost:5000/api-docs');
