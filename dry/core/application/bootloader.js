const fs = require('fs');
const path = require('path');
const express = require('express');

/**
 * 🚀 BOOTLOADER DRY - SYSTÈME DE CHARGEMENT DYNAMIQUE
 * Charge automatiquement les modules DRY et les applications dryApp 
 */

const { getTenantDB } = require('../../config/connection/dbConnection');
const getModel = require('../factories/modelFactory');
const passwordResetRoutes = require('../../modules/user/passwordReset.routes');
const authRoutes = require('../../modules/user/auth.routes');

const bootstrapApps = (app) => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║      🚀 DÉMARRAGE DU SYSTÈME DRY - BOOTLOADER v3.4         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ==========================================
  // ÉTAPE 1 : CHARGEMENT DES MODULES NATIFS DRY
  // ==========================================
  const dryModulesPath = path.join(__dirname, '../../modules');
  
  if (fs.existsSync(dryModulesPath)) {
    console.log('📦 MODULES DRY NATIFS :');
    console.log('─'.repeat(60));
    
    fs.readdirSync(dryModulesPath).forEach(moduleName => {
      const modulePath = path.join(dryModulesPath, moduleName);
      if (moduleName.toLowerCase() === 'user') {
        // console.log(`   ⚠️  ${moduleName.padEnd(15)} → ignored (mounted per app at /api/v1/<app>/user)`);
        return;
      }
      
      // Vérifier si c'est un dossier
      if (!fs.statSync(modulePath).isDirectory()) return;
      
      // Chercher les fichiers .routes.js
      const routeFiles = fs.readdirSync(modulePath).filter(f => f.endsWith('.routes.js'));
      
      routeFiles.forEach(file => {
        try {
          const routePath = path.join(modulePath, file);
          const router = require(routePath);
          
          // Monter sur /api/v1/{module}
          const endpoint = `/api/v1/${moduleName.toLowerCase()}`;
          app.use(endpoint, router);
          
          console.log(`   ✅ ${moduleName.padEnd(15)} → ${endpoint}`);
        } catch (error) {
          console.error(`   ❌ ${moduleName.padEnd(15)} → Erreur: ${error.message}`);
        }
      });
    });
  } else {
    console.warn('⚠️  Aucun module DRY natif trouvé dans dry/modules/');
  }

  // ==========================================
  // ÉTAPE 2 : SCAN DES APPLICATIONS (dryApp)
  // ==========================================
  const dryAppPath = path.join(__dirname, '../../../dryApp');

  if (!fs.existsSync(dryAppPath)) {
    console.error('\n❌ CRITICAL: Dossier dryApp introuvable !');
    console.error(`   Chemin attendu: ${dryAppPath}`);
    return;
  }

  const apps = fs.readdirSync(dryAppPath).filter(item => {
    const itemPath = path.join(dryAppPath, item);
    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
  });

  if (apps.length === 0) {
    console.warn('\n⚠️  Aucune application détectée dans dryApp/');
    return;
  }

  console.log('\n🏢 APPLICATIONS DÉTECTÉES :');
  console.log('─'.repeat(60));
  console.log(`   ${apps.join(', ')}\n`);

  // ==========================================
  // ÉTAPE 3 : BOOTSTRAP DE CHAQUE APPLICATION
  // ==========================================
  apps.forEach((appName) => {
    console.log(`\n📱 APPLICATION: ${appName}`);
    console.log('═'.repeat(60));

    // Initialiser la connexion DB spécifique
    try {
      getTenantDB(appName);
      console.log(`   ✅ Database: ${appName}DB connectée`);
    } catch (error) {
      console.error(`   ❌ Erreur DB ${appName}: ${error.message}`);
      return;
    }

    // Créer le routeur de l'application
    const appRouter = express.Router();

    // ==========================================
    // MIDDLEWARE DE CONTEXTE (req.appName, req.getModel)
    // ==========================================
    appRouter.use((req, res, next) => {
      req.appName = appName;
      req.getModel = (modelName, schema) => getModel(appName, modelName, schema);
      next();
    });

    console.log('   ✅ Middleware de contexte injecté');

    // Auth + password reset par application (tenant)
    appRouter.use('/user', authRoutes);
    appRouter.use('/password-reset', passwordResetRoutes);

    // ==========================================
    // CHARGEMENT DES FEATURES
    // ==========================================
    const featuresPath = path.join(dryAppPath, appName, 'features');

    if (!fs.existsSync(featuresPath)) {
      console.warn(`   ⚠️  Aucune feature dans ${appName}/features/`);
      app.use(`/api/v1/${appName.toLowerCase()}`, appRouter);
      return;
    }

    const features = fs.readdirSync(featuresPath).filter(item => {
      const itemPath = path.join(featuresPath, item);
      return fs.statSync(itemPath).isDirectory();
    });

    if (features.length === 0) {
      console.warn(`   ⚠️  Aucune feature détectée dans ${appName}/features/`);
    } else {
      console.log(`\n   📂 FEATURES (${features.length}):`);
      console.log('   ' + '─'.repeat(56));
    }

    features.forEach((feature) => {
      // Gestion de la casse (route vs Route)
      let routeDir = path.join(featuresPath, feature, 'route');
      
      if (!fs.existsSync(routeDir)) {
        routeDir = path.join(featuresPath, feature, 'Route');
      }

      if (!fs.existsSync(routeDir)) {
        console.warn(`   ⚠️  ${feature.padEnd(20)} → Pas de dossier route/`);
        return;
      }

      // Charger tous les fichiers .routes.js
      const routeFiles = fs.readdirSync(routeDir).filter(f => f.endsWith('.routes.js'));

      if (routeFiles.length === 0) {
        console.warn(`   ⚠️  ${feature.padEnd(20)} → Aucun fichier .routes.js`);
        return;
      }

      routeFiles.forEach((file) => {
        try {
          const routePath = path.join(routeDir, file);
          const router = require(routePath);
          
          // Monter sur /{feature}
          appRouter.use(`/${feature.toLowerCase()}`, router);
          console.log(`   ✅ ${feature.padEnd(20)} → /${feature.toLowerCase()}`);
        } catch (error) {
          console.error(`   ❌ ${feature.padEnd(20)} → Erreur: ${error.message}`);
          if (process.env.NODE_ENV === 'development') {
            console.error(`      Chemin: ${routePath}`);
            console.error(`      Stack: ${error.stack}`);
          }
        }
      });
    });

    // ==========================================
    // MONTAGE FINAL DE L'APPLICATION
    // ==========================================
    const appEndpoint = `/api/v1/${appName.toLowerCase()}`;
    app.use(appEndpoint, appRouter);
    console.log(`\n   🌐 Routes montées sur: ${appEndpoint}`);
    console.log('   ' + '═'.repeat(56));
  });

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ✅ BOOTLOADER TERMINÉ AVEC SUCCÈS                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
};

module.exports = bootstrapApps;
