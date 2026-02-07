const fs = require('fs');
const path = require('path');

/**
 * Script final pour nettoyer les routes avec doubles slashes
 */

const finalCleanup = () => {
  const dryAppPath = path.join(__dirname, '../dryApp');
  
  if (!fs.existsSync(dryAppPath)) {
    console.warn('⚠️ Dossier dryApp introuvable');
    return;
  }

  const apps = fs.readdirSync(dryAppPath).filter(app => !app.startsWith('.'));
  
  apps.forEach(appName => {
    const appPath = path.join(dryAppPath, appName);
    
    if (fs.statSync(appPath).isDirectory()) {
      const featuresPath = path.join(appPath, 'features');
      
      if (fs.existsSync(featuresPath)) {
        const features = fs.readdirSync(featuresPath).filter(feature => !feature.startsWith('.'));
        
        features.forEach(featureName => {
          const featurePath = path.join(featuresPath, featureName);
          
          if (fs.statSync(featurePath).isDirectory()) {
            const routePath = path.join(featurePath, 'route');
            
            if (fs.existsSync(routePath)) {
              const routeFiles = fs.readdirSync(routePath).filter(file => file.endsWith('.routes.js'));
              
              routeFiles.forEach(routeFile => {
                const fullPath = path.join(routePath, routeFile);
                cleanDoubleSlashes(fullPath);
              });
            }
          }
        });
      }
    }
  });
  
  console.log('✅ Nettoyage final terminé');
};

const cleanDoubleSlashes = (filePath) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remplacer les chemins avec doubles slashes dans les commentaires Swagger
    content = content.replace(/\/api\/v1\/[^\/]+\/\/[^:]+/g, (match) => {
      // Remplacer // par /feature/
      const parts = match.split('//');
      if (parts.length === 2) {
        const firstPart = parts[0];
        const secondPart = parts[1];
        
        // Extraire le nom de l'app du premier partie
        const appMatch = firstPart.match(/\/api\/v1\/([^\/]+)\/$/);
        if (appMatch) {
          const appName = appMatch[1];
          
          // Essayer de deviner la feature depuis le chemin du fichier
          const filePathParts = filePath.split(path.sep);
          const featureIndex = filePathParts.indexOf('features');
          let featureName = 'unknown';
          
          if (featureIndex !== -1 && filePathParts[featureIndex + 1]) {
            featureName = filePathParts[featureIndex + 1].toLowerCase();
          }
          
          return `${firstPart}${featureName}/${secondPart}`;
        }
      }
      return match;
    });
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`🧹 Nettoyé: ${path.relative(process.cwd(), filePath)}`);
    
  } catch (error) {
    console.error(`Erreur traitement ${filePath}: ${error.message}`);
  }
};

// Exécuter le nettoyage final
finalCleanup();
