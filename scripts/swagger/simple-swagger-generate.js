const fs = require('fs');
const path = require('path');

console.log('🔧 GÉNÉRATION SWAGGER SIMPLIFIÉE...\n');

// Fonction pour ajouter des commentaires Swagger de base
const addBasicSwaggerComments = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Vérifier si le fichier a déjà des commentaires Swagger
    if (content.includes('@swagger')) {
      console.log(`⏭️  ${path.basename(filePath)} a déjà des commentaires Swagger`);
      return;
    }
    
    // Ajouter un commentaire Swagger de base au début du fichier
    const swaggerHeader = `/**
 * @swagger
 * tags:
 *   - name: API
 *     description: API documentation
 */

`;
    
    // Insérer après les imports
    const lines = content.split('\n');
    const insertIndex = lines.findIndex(line => 
      line.startsWith('const ') || line.startsWith('router') || line.includes('require')
    ) + 1;
    
    if (insertIndex > 0) {
      lines.splice(insertIndex, 0, swaggerHeader);
      content = lines.join('\n');
      fs.writeFileSync(filePath, content);
      console.log(`✅ Commentaires ajoutés à ${path.basename(filePath)}`);
    }
    
  } catch (error) {
    console.log(`❌ Erreur pour ${path.basename(filePath)}: ${error.message}`);
  }
};

// Scanner les fichiers de routes
const scanRouteFiles = (dir, prefix = '') => {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      scanRouteFiles(itemPath, `${prefix}${item}/`);
    } else if (item.endsWith('.routes.js')) {
      console.log(`📝 Traitement: ${prefix}${item}`);
      addBasicSwaggerComments(itemPath);
    }
  });
};

// Scanner les deux répertoires principaux
console.log('🔍 Scan des fichiers de routes...\n');

scanRouteFiles(path.join(__dirname, '../dryApp'));
scanRouteFiles(path.join(__dirname, '../dry/modules'));

console.log('\n✅ GÉNÉRATION SWAGGER TERMINÉE !');
console.log('\n📋 Utilisation:');
console.log('1. Démarre le serveur: npm run dev');
console.log('2. Accède à Swagger: http://localhost:5000/api-docs');
