const fs = require('fs');
const path = require('path');
const express = require('express');

/**
 * 🚀 BOOTLOADER DRY - SYSTÈME DE CHARGEMENT DYNAMIQUE
 * Charge automatiquement les modules DRY et les applications dryApp 
 */

const { getTenantDB } = require('../../config/connection/dbConnection');
const config = require('../../../config/database');
const getModel = require('../factories/modelFactory');
const passwordResetRoutes = require('../../modules/user/passwordReset.routes');
const authRoutes = require('../../modules/user/auth.routes');
const passportPlugin = require('../plugins/passport.plugin');

// Routes d'authentification sociale (DRY)
const socialAuthRoutes = require('../../modules/user/socialAuth.routes');
const maintenanceMiddleware = require('../../middlewares/maintenance.middleware');

// ANSI Colors
const C = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  CYAN: '\x1b[36m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m'
};

const bootstrapApps = async (app) => {
  console.log(`\n${C.BRIGHT}${C.CYAN}╔══════════════════════════════════════════════════════════════╗${C.RESET}`);
  console.log(`${C.BRIGHT}${C.CYAN}║      🚀 DÉMARRAGE DU SYSTÈME DRY - BOOTLOADER v3.5         ║${C.RESET}`);
  console.log(`${C.BRIGHT}${C.CYAN}╚══════════════════════════════════════════════════════════════╝${C.RESET}\n`);

  // ==========================================
  // ÉTAPE -1 : PRÉ-CHARGEMENT DES SCHÉMAS GLOBAUX
  // ==========================================
  const modelsPath = path.join(__dirname, '../../modules');
  fs.readdirSync(modelsPath).forEach((dir) => {
    const modelDir = path.join(modelsPath, dir);
    if (fs.statSync(modelDir).isDirectory()) {
      fs.readdirSync(modelDir).forEach((file) => {
        if (file.endsWith('.schema.js')) {
          require(path.join(modelDir, file));
        }
      });
    }
  });

  // ==========================================
  // ÉTAPE 0 : INITIALISATION DES PLUGINS GLOBAUX
  // ==========================================
  passportPlugin.initialize(app);
  console.log(`\n${C.BRIGHT}${C.BLUE}🔌 PLUGINS GLOBAUX :${C.RESET}`);
  console.log(`${C.DIM}────────────────────────────────────────────────────────────${C.RESET}`);
  console.log(`   ${C.GREEN}✅ ${passportPlugin.name.padEnd(15)}${C.RESET} → ${C.DIM}${passportPlugin.description}${C.RESET}`);
  
  app.use('/api/auth', socialAuthRoutes);
  console.log(
    `   ${C.GREEN}✅ social-auth`.padEnd(21) +
      ` → ${C.DIM}/api/auth/google?app=SCIM , /api/auth/facebook?app=SCIM${C.RESET}`
  );

  // ==========================================
  // ÉTAPE 1 : CHARGEMENT DES MODULES NATIFS DRY
  // ==========================================
  const dryModulesPath = path.join(__dirname, '../../modules');
  
  if (fs.existsSync(dryModulesPath)) {
    console.log(`${C.BRIGHT}${C.BLUE}📦 MODULES DRY NATIFS :${C.RESET}`);
    console.log(`${C.DIM}────────────────────────────────────────────────────────────${C.RESET}`);
    
    fs.readdirSync(dryModulesPath).forEach(moduleName => {
      const modulePath = path.join(dryModulesPath, moduleName);
      
      if (!fs.statSync(modulePath).isDirectory()) return;

      if (moduleName.toLowerCase() === 'user') {
        console.log(`   ${C.CYAN}ℹ️  ${moduleName.padEnd(15)}${C.RESET} → ${C.DIM}Multi-Tenant (Injecté par App)${C.RESET}`);
        return;
      }
      
      const routeFiles = fs.readdirSync(modulePath).filter(f => f.endsWith('.routes.js'));
      
      routeFiles.forEach(file => {
        try {
          const routePath = path.join(modulePath, file);
          const router = require(routePath);
          const endpoint = `/api/v1/${moduleName.toLowerCase()}`;
          app.use(endpoint, router);
          
          console.log(`   ${C.GREEN}✅ ${moduleName.padEnd(15)}${C.RESET} → ${C.DIM}${endpoint}${C.RESET}`);
        } catch (error) {
          console.error(`   ${C.RED}❌ ${moduleName.padEnd(15)}${C.RESET} → Erreur: ${error.message}`);
        }
      });
    });
  }

  // ==========================================
  // ÉTAPE 2 : SCAN DES APPLICATIONS (dryApp)
  // ==========================================
  const dryAppPath = path.join(__dirname, '../../../dryApp');

  if (!fs.existsSync(dryAppPath)) {
    console.error(`\n${C.RED}❌ CRITICAL: Dossier dryApp introuvable !${C.RESET}`);
    console.error(`   Chemin attendu: ${dryAppPath}`);
    return;
  }

  const apps = fs.readdirSync(dryAppPath).filter(item => {
    const itemPath = path.join(dryAppPath, item);
    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
  });

  if (apps.length === 0) {
    console.warn(`\n${C.YELLOW}⚠️  Aucune application détectée dans dryApp/${C.RESET}`);
    return;
  }

  console.log(`\n${C.BRIGHT}${C.BLUE}🏢 APPLICATIONS DÉTECTÉES :${C.RESET}`);
  console.log(`${C.DIM}────────────────────────────────────────────────────────────${C.RESET}`);
  console.log(`   ${C.CYAN}${apps.join(`${C.RESET}, ${C.CYAN}`)}${C.RESET}\n`);

  // ==========================================
  // ÉTAPE 3 : BOOTSTRAP DE CHAQUE APPLICATION
  // ==========================================
  for (const appName of apps) {
    console.log(`\n${C.BRIGHT}${C.MAGENTA}📱 APPLICATION: ${appName}${C.RESET}`);
    console.log(`${C.DIM}════════════════════════════════════════════════════════════${C.RESET}`);

    try {
      getTenantDB(appName);
      console.log(`   ${C.GREEN}✅ Database:${C.RESET} ${appName}DB connectée`);
    } catch (error) {
      console.error(`   ${C.RED}❌ Erreur DB ${appName}:${C.RESET} ${error.message}`);
      continue;
    }

    const appRouter = express.Router();

    appRouter.use((req, res, next) => {
      req.appName = appName;
      req.getModel = (modelName, schema) => getModel(appName, modelName, schema);
      next();
    });

    appRouter.use(maintenanceMiddleware);

    console.log(`   ${C.GREEN}✅ Context:${C.RESET}  Middleware injecté`);

    console.log(`\n   ${C.BRIGHT}📦 MODULES NATIFS:${C.RESET}`);
    console.log(`   ${C.DIM}────────────────────────────────────────────────────────${C.RESET}`);
    
    appRouter.use('/user', authRoutes);
    console.log(`   ${C.GREEN}✅ user${C.RESET} → ${C.DIM}/user${C.RESET}`);

    appRouter.use('/password-reset', passwordResetRoutes);
    console.log(`   ${C.GREEN}✅ password-reset${C.RESET} → ${C.DIM}/password-reset${C.RESET}`);

    const featuresPath = path.join(dryAppPath, appName, 'features');
    if (fs.existsSync(featuresPath)) {
      const features = fs.readdirSync(featuresPath).filter(item => {
        const itemPath = path.join(featuresPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

      if (features.length > 0) {
        console.log(`\n   ${C.BRIGHT}📂 FEATURES (${features.length}):${C.RESET}`);
        console.log(`   ${C.DIM}────────────────────────────────────────────────────────${C.RESET}`);

        for (const feature of features) {
          let routeDir = path.join(featuresPath, feature, 'route');
          if (!fs.existsSync(routeDir)) {
            routeDir = path.join(featuresPath, feature, 'Route');
          }

          if (!fs.existsSync(routeDir)) {
            console.warn(`   ${C.YELLOW}⚠️  ${feature.padEnd(20)} → Pas de dossier route/${C.RESET}`);
            continue;
          }

          const routeFiles = fs.readdirSync(routeDir).filter(f => f.endsWith('.routes.js'));

          if (routeFiles.length === 0) {
            console.warn(`   ${C.YELLOW}⚠️  ${feature.padEnd(20)} → Aucun fichier .routes.js${C.RESET}`);
            continue;
          }

          for (const file of routeFiles) {
            let routePath;
            try {
              routePath = path.join(routeDir, file);
              const router = require(routePath);
              appRouter.use(`/${feature.toLowerCase()}`, router);
              console.log(`   ${C.GREEN}✅ ${feature.padEnd(20)}${C.RESET} → ${C.DIM}/${feature.toLowerCase()}${C.RESET}`);
            } catch (error) {
              console.error(`   ${C.RED}❌ ${feature.padEnd(20)} → Erreur: ${error.message}${C.RESET}`);
              if (config.NODE_ENV === 'development') {
                console.error(`      Chemin: ${routePath}`);
                console.error(`      Stack: ${error.stack}`);
              }
            }
          }
        }
      }
    }

    const appIndexPath = path.join(dryAppPath, appName, 'index.js');
    let initResult = null;
    if (fs.existsSync(appIndexPath)) {
      try {
        const appModule = require(appIndexPath);
        if (appModule.initFreeLLM || appModule.bootstrap) {
          console.log(`\n   ${C.BRIGHT}🚀 Initialisation personnalisée:${C.RESET}`);
          
          const initFn = appModule.initFreeLLM || appModule.bootstrap;
          initResult = await initFn(appName);
          
          if (appModule.mountFreeLLMRoutes || appModule.mountRoutes) {
            const mountFn = appModule.mountFreeLLMRoutes || appModule.mountRoutes;
            mountFn(app, appName, 
              initResult.Models, initResult.ApiKeys, 
              initResult.FallbackConfig, initResult.Requests, 
              initResult.Settings, 
              initResult.Conversations, initResult.ConversationMessages,
              initResult.unifiedApiKey);
          }
        }
      } catch (error) {
        console.error(`   ${C.RED}❌ Erreur d'initialisation personnalisée:${C.RESET} ${error.message}`);
        if (config.NODE_ENV === 'development') {
          console.error(`      Stack: ${error.stack}`);
        }
      }
    }

    const appEndpoint = `/api/v1/${appName.toLowerCase()}`;
    app.use(appEndpoint, appRouter);
    console.log(`\n   ${C.CYAN}🌐 Routes montées sur:${C.RESET} ${appEndpoint}`);
    console.log(`   ${C.DIM}════════════════════════════════════════════════════════════${C.RESET}`);
  }

  console.log(`\n${C.BRIGHT}${C.GREEN}╔══════════════════════════════════════════════════════════════╗${C.RESET}`);
  console.log(`${C.BRIGHT}${C.GREEN}║           ✅ BOOTLOADER TERMINÉ AVEC SUCCÈS                 ║${C.RESET}`);
  console.log(`${C.BRIGHT}${C.GREEN}╚══════════════════════════════════════════════════════════════╝${C.RESET}\n`);
};

module.exports = bootstrapApps;
