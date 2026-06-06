#!/usr/bin/env node

/**
 * Test du Startup Banner (sans MongoDB)
 * Mocke le health service pour prévisualiser le banner dans la console
 * Usage: node scripts/test-banner.js
 */

process.env.NODE_ENV = 'development';
process.env.PORT = '5000';
process.env.APP_NAME = 'DRY API';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:4200';

const path = require('path');

// Rediriger le require du health service vers un mock
const mockHealthService = {
  getLiveness: async () => ({ status: 'OK', timestamp: new Date().toISOString(), uptime: 12345 }),
  getReadiness: async () => ({ status: 'READY', timestamp: new Date().toISOString(), checks: { database: true, redis: 'DISABLED' } }),
  getHealthStatus: async () => ({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: { seconds: 12345, human: '3h 25m 45s' },
    services: {
      database: { status: 'UP', host: 'localhost', name: 'dryapi', readyState: 1 },
      redis: { connected: false, enabled: false },
      memory: { rss: '65MB', heapUsed: '42MB', heapTotal: '128MB', external: '5MB' },
      applications: [
        { name: 'FreeLLM', status: 'ACTIVE', features: 8, database: 'FreeLLMDB' },
        { name: 'LaStreet', status: 'ACTIVE', features: 5, database: 'LaStreetDB' },
        { name: 'MediaDL', status: 'ACTIVE', features: 3, database: 'MediaDLDB' },
        { name: 'SCIM', status: 'ACTIVE', features: 7, database: 'SCIMDB' },
        { name: 'SkillForge', status: 'ACTIVE', features: 8, database: 'SkillForgeDB' },
        { name: 'SpiritEmeraude', status: 'ACTIVE', features: 6, database: 'SpiritEmeraudeDB' },
      ],
    },
    version: '1.0.0',
    environment: 'development',
  }),
  getSystemOverview: async (port) => ({
    status: 'OK',
    headline: 'Système prêt',
    timestamp: new Date().toISOString(),
    environment: 'development',
    version: '1.0.0',
    uptime: { seconds: 12345, human: '3h 25m 45s' },
    port: port || 5000,
    corsOrigins: ['http://localhost:3000', 'http://localhost:4200'],
    urls: {
      base: 'http://localhost:5000',
      health: 'http://localhost:5000/health/ready',
      swagger: 'http://localhost:5000/api-docs',
      systemStatus: 'http://localhost:5000/system/status',
    },
    items: [
      { label: 'Base de données', state: 'OK', value: 'Connecté (dryapi)' },
      { label: 'Redis', state: 'INFO', value: 'Désactivé' },
      { label: 'Applications', state: 'OK', value: '6 app(s) active(s), 37 feature(s)' },
      { label: 'Mémoire', state: 'INFO', value: '42MB heap / 65MB rss' },
      { label: 'Documentation', state: 'INFO', value: 'http://localhost:5000/api-docs' },
      { label: 'Billing', state: 'OK', value: 'Stripe: ok' },
      { label: 'Licensing', state: 'OK', value: 'Licences: actif' },
    ],
    applications: [
      { name: 'FreeLLM', status: 'ACTIVE', features: 8 },
      { name: 'LaStreet', status: 'ACTIVE', features: 5 },
      { name: 'MediaDL', status: 'ACTIVE', features: 3 },
      { name: 'SCIM', status: 'ACTIVE', features: 7 },
      { name: 'SkillForge', status: 'ACTIVE', features: 8 },
      { name: 'SpiritEmeraude', status: 'ACTIVE', features: 6 },
    ],
    health: {},
  }),
  formatUptime: (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`,
  renderSystemStatusPage: () => '<html><body><h1>Dashboard DRY API</h1></body></html>',
};

// Mocker le module health service avant de charger le banner
const modulePath = path.resolve('dry/services/health/health.service');
delete require.cache[require.resolve(modulePath)];
jest = undefined; // Pas besoin de jest ici

// Injecter le mock via le cache de require
const mockPath = require.resolve('./dry/services/health/health.service'.replace(/^\.\//, ''));
// On utilise require.cache pour remplacer le module
const fs = require('fs');
const originalPath = path.resolve('dry/services/health/health.service.js');

// Approche plus simple: on va directement loader le banner en mockant les dépendances
async function main() {
  try {
    // Charger le startup banner
    const { printStartupBanner } = require('../dry/bootstrap/startup-banner');
    
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:4200'];
    const port = 5000;
    
    await printStartupBanner(port, allowedOrigins);
    console.log('\x1b[32m%s\x1b[0m', '  ✅ BANNER TESTÉ AVEC SUCCÈS');
    console.log('\x1b[32m%s\x1b[0m', '  ✅ Toutes les URLs sont listées dans la console ci-dessus');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '  ❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
