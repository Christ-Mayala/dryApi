const fs = require('fs');
const path = require('path');
const express = require('express');

// --- CORRECTION DES CHEMINS SELON TA NOUVELLE STRUCTURE ---
// 1. La connexion est maintenant dans config/connection
const { getTenantDB } = require('../config/connection/dbConnection');
const getModel = require('./modelFactory');

// 2. Les routes Auth sont dans modules/user
const authRoutes = require('../modules/user/auth.routes');

const bootstrapApps = (app) => {
  // Chemin vers le dossier dryApp (on remonte de dry/core -> dry -> root -> dryApp)
  const dryAppPath = path.join(__dirname, '../../dryApp');

  if (!fs.existsSync(dryAppPath)) {
    console.error('❌ CRITICAL: Dossier dryApp introuvable !');
    return;
  }

  // Scan des dossiers (SpiritEmeraude, Voyage, etc.)
  const apps = fs.readdirSync(dryAppPath);

  apps.forEach((appName) => {
    // Ignorer les fichiers cachés système
    if (appName.startsWith('.')) return;

    console.log(`\n--- 🚀 DÉMARRAGE APP : ${appName} ---`);

    // 1. Initialiser la connexion DB spécifique (ex: SpiritEmeraudeDB)
    getTenantDB(appName);

    // 2. Créer le routeur de l'application
    const appRouter = express.Router();

    // 3. Middleware d'injection de contexte (Model Factory)
    //    On expose req.getModel(name, schema) pour que chaque feature puisse
    //    passer explicitement son schéma Mongoose (ImpactSchema, GallerySchema, ...).
    appRouter.use((req, res, next) => {
      req.appName = appName;
      req.getModel = (name, schema) => getModel(appName, name, schema);
      next();
    });

    // 4. Chargement du Module User (Natif DRY)
    // URL: /api/v1/{appName}/auth/...
    appRouter.use('/auth', authRoutes);
    console.log(`   ✅ Module DRY chargé : Auth (User)`);

    // 5. Chargement des Features de l'App
    const featuresPath = path.join(dryAppPath, appName, 'features');

    if (fs.existsSync(featuresPath)) {
      const features = fs.readdirSync(featuresPath);

      features.forEach((feature) => {
        // Gestion de la casse : 'Route' (Windows/Script) ou 'route' (Linux)
        let routeDir = path.join(featuresPath, feature, 'Route');
        if (!fs.existsSync(routeDir)) {
          routeDir = path.join(featuresPath, feature, 'route');
        }

        if (fs.existsSync(routeDir)) {
          fs.readdirSync(routeDir).forEach((file) => {
            if (file.endsWith('.routes.js')) {
              const router = require(path.join(routeDir, file));
              // URL: /api/v1/{appName}/{feature}
              appRouter.use(`/${feature.toLowerCase()}`, router);
              console.log(`   ✅ Feature chargée : ${feature}`);
            }
          });
        }
      });
    } else {
      console.warn(`   ⚠️  Aucune feature trouvée dans ${appName}`);
    }

    // 6. MONTAGE FINAL AVEC /v1
    // URL FINALE : /api/v1/spiritemeraude
    app.use(`/api/v1/${appName.toLowerCase()}`, appRouter);
    console.log(`🌎 Routes montées sur : /api/v1/${appName.toLowerCase()}`);
  });
};

module.exports = bootstrapApps;
