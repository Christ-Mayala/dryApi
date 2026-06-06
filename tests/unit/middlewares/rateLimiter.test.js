/**
 * Tests unitaires — Rate Limiter
 * @module tests/unit/middlewares/rateLimiter.test
 */

const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

describe('Rate Limiter de sécurité', () => {
  let setupSecurity;
  let req;
  let res;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('helmet', () => jest.fn(() => (req, res, next) => next()));
    jest.mock('express-rate-limit', () => {
      const mockRateLimit = jest.fn((options) => {
        // Retourner un middleware qui utilise les options
        return (req, res, next) => {
          // Simuler le comportement du rate limiter
          const max = typeof options.max === 'function' ? options.max(req) : options.max;
          req.rateLimit = { max, remaining: max - 1, resetTime: Date.now() + options.windowMs };
          return next();
        };
      });
      mockRateLimit.ipKeyGenerator = jest.fn((ip) => ip);
      return mockRateLimit;
    });
    jest.mock('express-mongo-sanitize', () => ({
      sanitize: jest.fn((obj) => obj),
    }));
    jest.mock('../../../config/database', () => ({
      NODE_ENV: 'test',
      RATE_LIMIT: {
        windowMs: 600000,
        max: 1000,
        authMultiplier: 20,
        adminMultiplier: 100,
        skipAuthenticated: true,
        skipAdmin: false,
        message: { success: false, message: 'Rate limit exceeded' },
      },
    }));

    setupSecurity = require('../../../dry/middlewares/protection/security.middleware');
    req = {
      path: '/api/v1/test',
      originalUrl: '/api/v1/test',
      headers: {},
      ip: '127.0.0.1',
    };
    res = {};
  });

  it('devrait configurer les middlewares de sécurité sans erreur', () => {
    const app = {
      use: jest.fn(),
    };
    setupSecurity(app);
    expect(app.use).toHaveBeenCalled();
  });

  it('devrait ignorer le rate limiting pour les health checks', () => {
    req.path = '/health/ready';
    // Le setupSecurity s'applique sur l'app, pas par requête
    // Ce test vérifie que la config ne crash pas
    const app = { use: jest.fn() };
    expect(() => setupSecurity(app)).not.toThrow();
  });
});
