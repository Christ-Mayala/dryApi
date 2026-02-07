const config = {
  development: {
    MONGO_URI: process.env.MONGO_URI_DEV || process.env.MONGO_URI,
    REDIS_URL: process.env.REDIS_URL_DEV || 'redis://localhost:6379',
    JWT_SECRET: process.env.JWT_SECRET_DEV || process.env.JWT_SECRET,
    JWT_EXPIRE: process.env.JWT_EXPIRE_DEV || process.env.JWT_EXPIRE || '7d',
    PORT: process.env.PORT_DEV || 5000,
    LOG_REQUESTS: process.env.LOG_REQUESTS_DEV || 'true',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS_DEV || 'http://localhost:3000,http://localhost:3001'
  },
  
  production: {
    MONGO_URI: process.env.MONGO_URI,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
    PORT: process.env.PORT || 5000,
    LOG_REQUESTS: process.env.LOG_REQUESTS || 'false',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*'
  },
  
  test: {
    MONGO_URI: process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/dryapi_test',
    REDIS_URL: process.env.REDIS_URL_TEST || 'redis://localhost:6379/1',
    JWT_SECRET: process.env.JWT_SECRET_TEST || 'test_secret_key',
    JWT_EXPIRE: process.env.JWT_EXPIRE_TEST || '1h',
    PORT: process.env.PORT_TEST || 5001,
    LOG_REQUESTS: process.env.LOG_REQUESTS_TEST || 'false',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS_TEST || 'http://localhost:3000'
  }
};

const env = process.env.NODE_ENV || 'development';

// Validation des variables requises
const requiredVars = ['MONGO_URI', 'JWT_SECRET'];
const currentConfig = config[env];

requiredVars.forEach(varName => {
  if (!currentConfig[varName]) {
    throw new Error(`Variable d'environnement requise manquante: ${varName}`);
  }
});

// Fusionner avec les variables d'environnement actuelles
const finalConfig = {
  ...currentConfig,
  NODE_ENV: env,
  
  // Configuration supplémentaire
  CORS: {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token']
  },
  
  RATE_LIMIT: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: env === 'production' ? 100 : 1000, // Plus strict en production
    message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard.' }
  },
  
  UPLOAD: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/webm']
  },
  
  CACHE: {
    defaultDuration: env === 'production' ? 600 : 300, // 10min en prod, 5min en dev
    userCacheDuration: 1800, // 30 minutes
    staticCacheDuration: 3600 // 1 heure
  }
};

module.exports = finalConfig;
