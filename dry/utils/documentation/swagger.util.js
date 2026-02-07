const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

// Configuration Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DRY Multi-Tenant API',
      version: '1.0.0',
      description: 'API multi-tenant avec architecture DRY',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Serveur de développement'
      },
      {
        url: 'https://dryapi.onrender.com',
        description: 'Serveur de production'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token pour l\'authentification'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'ID de l\'utilisateur' },
            email: { type: 'string', format: 'email', description: 'Email de l\'utilisateur' },
            name: { type: 'string', description: 'Nom de l\'utilisateur' },
            role: { type: 'string', enum: ['user', 'admin'], description: 'R�le de l\'utilisateur' },
            status: { type: 'string', enum: ['active', 'inactive'], description: 'Statut du compte' },
            createdAt: { type: 'string', format: 'date-time', description: 'Date de cr�ation' },
            updatedAt: { type: 'string', format: 'date-time', description: 'Date de mise � jour' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', description: 'Message d\'erreur' },
            data: { type: 'object', nullable: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', description: 'Message de succ�s' },
            data: { type: 'object', description: 'Donn�es retourn�es' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Op�ration r�ussie' },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Erreur' },
            data: { type: 'object', nullable: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './server.js',
    './dry/**/*.js',
    './dryApp/**/*.js',
    './dry/modules/**/*.js'
  ]
};

// Fonction pour scanner automatiquement toutes les routes des applications
const scanAppRoutes = () => {
  const routes = [];
  const dryAppPath = path.join(__dirname, '../../../dryApp');
  
  if (!fs.existsSync(dryAppPath)) {
    console.warn('?? Dossier dryApp introuvable pour Swagger');
    return routes;
  }

  // Scanner toutes les applications
  const apps = fs.readdirSync(dryAppPath).filter(app => !app.startsWith('.'));
  
  apps.forEach(appName => {
    const appPath = path.join(dryAppPath, appName);
    
    if (fs.statSync(appPath).isDirectory()) {
      // Scanner les features de l'application
      const featuresPath = path.join(appPath, 'features');
      
      if (fs.existsSync(featuresPath)) {
        const features = fs.readdirSync(featuresPath).filter(feature => !feature.startsWith('.'));
        
        features.forEach(featureName => {
          const featurePath = path.join(featuresPath, featureName);
          
          if (fs.statSync(featurePath).isDirectory()) {
            // Scanner les routes dans le dossier route
            const routePath = path.join(featurePath, 'route');
            
            if (fs.existsSync(routePath)) {
              const routeFiles = fs.readdirSync(routePath).filter(file => file.endsWith('.routes.js'));
              
              routeFiles.forEach(routeFile => {
                const fullPath = path.join(routePath, routeFile);
                routes.push({
                  app: appName,
                  feature: featureName,
                  file: routeFile,
                  path: fullPath
                });
              });
            }
          }
        });
      }
    }
  });

  return routes;
};

// Scanner les modules DRY
const scanDryModules = () => {
  const routes = [];
  const dryModulesPath = path.join(__dirname, '../../modules');
  
  if (!fs.existsSync(dryModulesPath)) {
    console.warn('?? Dossier dry/modules introuvable pour Swagger');
    return routes;
  }

  const modules = fs.readdirSync(dryModulesPath).filter(module => !module.startsWith('.'));
  
  modules.forEach(moduleName => {
    const modulePath = path.join(dryModulesPath, moduleName);
    
    if (fs.statSync(modulePath).isDirectory()) {
      // Chercher les fichiers de routes
      const routeFiles = fs.readdirSync(modulePath).filter(file => file.endsWith('.routes.js'));
      
      routeFiles.forEach(routeFile => {
        const fullPath = path.join(modulePath, routeFile);
        routes.push({
          app: 'DRY',
          feature: moduleName,
          file: routeFile,
          path: fullPath
        });
      });
    }
  });

  return routes;
};

// G�n�rer les sp�cifications Swagger (avec cache pour �viter les doublons)
let cachedSpecs = null;
const generateSwaggerSpecs = () => {
  if (cachedSpecs) {
    return cachedSpecs;
  }
  
  try {
    const specs = swaggerJsdoc(swaggerOptions);
    
    // Afficher les routes trouv�es (une seule fois)
    const appRoutes = scanAppRoutes();
    const dryRoutes = scanDryModules();
    
    console.log(`?? Swagger: ${appRoutes.length + dryRoutes.length} routes trouv�es`);
    
    cachedSpecs = specs;
    return specs;
  } catch (error) {
    console.error('? Erreur g�n�ration Swagger:', error.message);
    return {};
  }
};

// Middleware Swagger UI
const swaggerUiMiddleware = swaggerUi.serve;

// Configuration Swagger UI
const swaggerUiSetup = swaggerUi.setup(generateSwaggerSpecs(), {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'DRY Multi-Tenant API Documentation',
  customfavIcon: '/favicon.ico'
});

// Exporter les fonctions
module.exports = {
  swaggerUiMiddleware,
  swaggerUiSetup,
  generateSwaggerRoutes: generateSwaggerSpecs,
  scanAppRoutes,
  scanDryModules
};
