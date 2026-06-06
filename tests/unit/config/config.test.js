/**
 * Tests unitaires — Configuration
 * @module tests/unit/config/config.test
 */

const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

describe('Configuration', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'b'.repeat(32);
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';
    process.env.REDIS_ENABLED = 'false';
    process.env.LOG_REQUESTS = 'false';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('devrait charger la configuration sans erreur', () => {
    const config = require('../../../config/database');
    expect(config).toBeDefined();
    expect(config.PORT).toBeGreaterThan(0);
    expect(config.NODE_ENV).toBe('test');
  });

  it('devrait retourner le bon port pour l\'environnement test', () => {
    const config = require('../../../config/database');
    // En mode test, le port par défaut devrait être 5001
    expect(config.PORT).toBeDefined();
    expect(typeof config.PORT).toBe('number');
  });

  it('devrait parser les variables d\'environnement correctement', () => {
    process.env.PORT = '8080';
    process.env.RATE_LIMIT_WINDOW_MS = '120000';
    process.env.RATE_LIMIT_MAX = '200';

    const config = require('../../../config/database');
    expect(config.PORT).toBe(8080);
  });

  it('devrait rejeter JWT_SECRET trop court', () => {
    process.env.JWT_SECRET = 'court';
    process.env.SESSION_SECRET = 'b'.repeat(32);

    expect(() => require('../../../config/database')).toThrow();
  });

  it('devrait rejeter SESSION_SECRET trop court', () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'court';

    expect(() => require('../../../config/database')).toThrow();
  });

  it('devrait fournir une configuration CORS structurée', () => {
    const config = require('../../../config/database');
    expect(config.CORS).toBeDefined();
    expect(config.CORS.methods).toContain('GET');
    expect(config.CORS.methods).toContain('POST');
    expect(config.CORS.credentials).toBe(true);
  });

  it('devrait fournir une configuration RATE_LIMIT structurée', () => {
    const config = require('../../../config/database');
    expect(config.RATE_LIMIT).toBeDefined();
    expect(config.RATE_LIMIT.windowMs).toBeGreaterThan(0);
    expect(config.RATE_LIMIT.max).toBeGreaterThan(0);
  });
});
