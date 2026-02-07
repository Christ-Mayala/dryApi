const mongoose = require('mongoose');
const redisService = require('../cache/redis.service');

class HealthService {
  async getHealthStatus() {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    // VÃ©rifier la connexion MongoDB
    const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
    const dbInfo = {
      status: dbStatus,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState
    };

    // VÃ©rifier Redis
    const redisStatus = redisService.getStatus();
    const redisEnabledFlag = String(process.env.REDIS_ENABLED || '').toLowerCase();
    const redisEnabled = redisEnabledFlag === 'true' || (!!process.env.REDIS_URL && redisEnabledFlag !== 'false');
    redisStatus.enabled = redisEnabled;

    // VÃ©rifier les applications
    const apps = await this.getAppsStatus();

    // Calculer le statut global
    const allServicesUp = dbStatus === 'UP' && (!redisEnabled || redisStatus.connected);
    const globalStatus = allServicesUp ? 'OK' : 'DEGRADED';

    return {
      status: globalStatus,
      timestamp,
      uptime: {
        seconds: uptime,
        human: this.formatUptime(uptime)
      },
      services: {
        database: dbInfo,
        redis: redisStatus,
        memory: {
          rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memory.external / 1024 / 1024)}MB`
        },
        applications: apps
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  async getAppsStatus() {
    const fs = require('fs');
    const path = require('path');
    
    const dryAppPath = path.join(__dirname, '../../../dryApp');
    const apps = [];

    if (fs.existsSync(dryAppPath)) {
      const appFolders = fs.readdirSync(dryAppPath).filter(folder => !folder.startsWith('.'));
      
      for (const appName of appFolders) {
        try {
          // VÃ©rifier si l'application a des features
          const featuresPath = path.join(dryAppPath, appName, 'features');
          const hasFeatures = fs.existsSync(featuresPath);
          
          // Compter les features
          let featureCount = 0;
          if (hasFeatures) {
            const features = fs.readdirSync(featuresPath);
            featureCount = features.length;
          }

          apps.push({
            name: appName,
            status: 'ACTIVE',
            features: featureCount,
            database: `${appName}DB`
          });
        } catch (error) {
          apps.push({
            name: appName,
            status: 'ERROR',
            error: error.message
          });
        }
      }
    }

    return apps;
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}j ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  async getLiveness() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  async getReadiness() {
    const dbReady = mongoose.connection.readyState === 1;
    const redisEnabledFlag = String(process.env.REDIS_ENABLED || '').toLowerCase();
    const redisEnabled = redisEnabledFlag === 'true' || (!!process.env.REDIS_URL && redisEnabledFlag !== 'false');
    const redisReady = redisService.getStatus().connected;
    
    return {
      status: dbReady && (!redisEnabled || redisReady) ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbReady,
        redis: redisEnabled ? redisReady : 'DISABLED'
      }
    };
  }
}

module.exports = new HealthService();

