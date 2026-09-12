/**
 * Tests unitaires — Rate limiting du programme de parrainage
 *
 * Vérifie la séparation validate (souple) / claim (strict) :
 *   - validateLimiter limite les consultations publiques sans block les vrais clics
 *   - claimLimiter est plus strict et cible le compte connecté (pas juste l'IP)
 * @module tests/unit/trivida/referralRateLimit.test
 */

describe('Referral Rate Limit (audit sécurité)', () => {
  let validateLimiter;
  let claimLimiter;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('express-rate-limit', () => {
      const mockRateLimit = jest.fn((options) => {
        options.__calls = (options.__calls || 0) + 1;
        return (req, res, next) => {
          req.rateLimitOptions = options;
          if (typeof options.keyGenerator === 'function') options.keyGenerator(req);
          return next();
        };
      });
      mockRateLimit.ipKeyGenerator = jest.fn((key) => key);
      return mockRateLimit;
    });
    jest.mock('../../../config/database', () => ({
      NODE_ENV: 'test',
      REFERRAL: {
        rewardNewUser: 1,
        rewardReferrer: 1,
        activityThreshold: 5,
        rateLimit: {
          validate: { windowMs: 900000, max: 200 },
          claim: { windowMs: 3600000, max: 50 },
        },
      },
    }));

    const { validateLimiter: vl, claimLimiter: cl } = require('../../../dryApp/Trivida/features/referral/middleware/referralRateLimit');
    validateLimiter = vl;
    claimLimiter = cl;
  });

  it('validateLimiter : borné (souple) pour les consultations publiques', () => {
    const req = { ip: '1.2.3.4' };
    const res = {};
    validateLimiter(req, res, jest.fn());
    expect(req.rateLimitOptions.windowMs).toBe(900000);
    expect(req.rateLimitOptions.max).toBe(200);
  });

  it('claimLimiter : plus strict que validate (le claim accorde des requêtes IA)', () => {
    const req = { ip: '1.2.3.4' };
    const res = {};
    claimLimiter(req, res, jest.fn());
    expect(req.rateLimitOptions.windowMs).toBeGreaterThan(0);
    expect(req.rateLimitOptions.max).toBeLessThan(200);
  });

  it('claimLimiter : cible le compte connecté (req.user) plutôt que la seule IP', () => {
    const req = { ip: '1.2.3.4', user: { _id: 'USER_123' } };
    const res = {};
    const received = jest.fn();
    claimLimiter(req, res, received);
    // La clé générée inclut l'identifiant du compte → un spam à travers des IP
    // différentes reste borné par compte.
    const { ipKeyGenerator } = require('express-rate-limit');
    expect(ipKeyGenerator).toHaveBeenCalledWith('user:USER_123');
  });

  it('claimLimiter : en mode invité (sans auth), bascule sur l IP', () => {
    const req = { ip: '9.9.9.9' };
    const res = {};
    claimLimiter(req, res, jest.fn());
    const { ipKeyGenerator } = require('express-rate-limit');
    expect(ipKeyGenerator).toHaveBeenCalledWith('9.9.9.9');
  });
});