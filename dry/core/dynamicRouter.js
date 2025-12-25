const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const loadRoutes = (app) => {
    const appName = process.env.APP_NAME;
    if (!appName) {
        console.error('❌ CRITICAL: APP_NAME non défini dans le .env');
        process.exit(1);
    }

    console.log(`\n--- 🚀 DÉMARRAGE DE L'APP : ${appName} ---\n`);

    // 1. CHARGEMENT DES MODULES NATIFS DRY (ex: User)
    const dryModulesPath = path.join(__dirname, '../../modules');
    if (fs.existsSync(dryModulesPath)) {
        fs.readdirSync(dryModulesPath).forEach(moduleName => {
            const routesPath = path.join(dryModulesPath, moduleName, `${moduleName.toLowerCase()}.routes.js`); // user.routes.js
            
            // On cherche n'importe quel fichier finissant par .routes.js
            const files = fs.readdirSync(path.join(dryModulesPath, moduleName)).filter(f => f.endsWith('.routes.js'));
            
            files.forEach(file => {
                const finalPath = path.join(dryModulesPath, moduleName, file);
                const endpoint = `/api/v1/${moduleName.toLowerCase()}`;
                app.use(endpoint, require(finalPath));
                console.log(`[DRY CORE]  ✅ Module chargé : ${endpoint}`);
            });
        });
    }

    // 2. CHARGEMENT DES FEATURES SPÉCIFIQUES À L'APP (Voyage)
    const appPath = path.join(__dirname, '../../../dryApp', appName, 'features');
    
    if (fs.existsSync(appPath)) {
        fs.readdirSync(appPath).forEach(feature => {
            const routeDir = path.join(appPath, feature, 'route');
            if (fs.existsSync(routeDir)) {
                fs.readdirSync(routeDir).filter(f => f.endsWith('.routes.js')).forEach(file => {
                    const endpoint = `/api/v1/${feature.toLowerCase()}`;
                    app.use(endpoint, require(path.join(routeDir, file)));
                    console.log(`[APP ${appName.toUpperCase()}] ✅ Feature chargée : ${endpoint}`);
                });
            }
        });
    } else {
        console.warn(`[WARNING] Aucune feature trouvée pour ${appName} dans dryApp/`);
    }
};

module.exports = loadRoutes;