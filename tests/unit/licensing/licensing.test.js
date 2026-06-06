/**
 * Tests unitaires — Module Licensing
 * Couvre : création, validation, format, limites, middleware
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const licensing = require('../../../dry/modules/licensing');

describe('Licensing — Génération de clés', () => {
  it('generateLicenseKey() devrait générer une clé au format DRY-XXXX-XXXX-XXXX-XXXX-XXXX', () => {
    const key = licensing.generateLicenseKey('pro', 'cust_123');
    assert.ok(key.startsWith('DRY-'));
    // Format: DRY-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (6 groupes de 4 après DRY-)
    assert.equal(key.length, 33);
    assert.ok(/^DRY-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){5}$/.test(key));
  });

  it('generateLicenseKey() devrait produire des clés uniques', () => {
    const key1 = licensing.generateLicenseKey('community', 'a');
    const key2 = licensing.generateLicenseKey('community', 'a');
    assert.notEqual(key1, key2); // Différent grâce au random
  });

  it('generateLicenseKey() devrait fonctionner pour tous les tiers', () => {
    for (const tier of ['community', 'pro', 'enterprise']) {
      const key = licensing.generateLicenseKey(tier, 'test');
      assert.ok(key.startsWith('DRY-'), 'Échec pour tier: ' + tier);
    }
  });
});

describe('Licensing — Validation de format', () => {
  it('validateLicenseFormat() devrait accepter une clé valide', () => {
    const key = licensing.generateLicenseKey('pro', 'cust_456');
    assert.ok(licensing.validateLicenseFormat(key));
  });

  it('validateLicenseFormat() devrait rejeter les formats invalides', () => {
    assert.equal(licensing.validateLicenseFormat(null), false);
    assert.equal(licensing.validateLicenseFormat(''), false);
    assert.equal(licensing.validateLicenseFormat('INVALID-KEY'), false);
    assert.equal(licensing.validateLicenseFormat('DRY-XXXX'), false);
    assert.equal(licensing.validateLicenseFormat('ABC-1234-5678'), false);
    assert.equal(licensing.validateLicenseFormat(123), false);
  });
});

describe('Licensing — Hash et vérification', () => {
  it('hashLicenseKey() et verifyLicenseKey() devraient être compatibles', async () => {
    const key = licensing.generateLicenseKey('pro', 'hash_test');
    const hash = await licensing.hashLicenseKey(key);
    const valid = await licensing.verifyLicenseKey(key, hash);
    assert.equal(valid, true);
  });

  it('verifyLicenseKey() devrait rejeter une clé incorrecte', async () => {
    const key = licensing.generateLicenseKey('pro', 'real');
    const hash = await licensing.hashLicenseKey(key);
    const valid = await licensing.verifyLicenseKey('WRONG-KEY', hash);
    assert.equal(valid, false);
  });
});

describe('Licensing — Création de licence', () => {
  it('createLicense() devrait créer une licence valide', async () => {
    const license = await licensing.createLicense({
      tier: 'pro',
      customerId: 'cust_789',
      customerEmail: 'test@dry.local',
      customerName: 'Test User',
      durationDays: 365,
    });

    assert.ok(license.key);
    assert.equal(license.tier, 'pro');
    assert.equal(license.status, 'active');
    assert.equal(license.customerEmail, 'test@dry.local');
    assert.ok(license.issuedAt);
    assert.ok(license.expiresAt);
    assert.ok(license.metadata.features.includes('api_full'));
  });

  it('createLicense() devrait rejeter un tier invalide', async () => {
    await assert.rejects(
      async () => {
        await licensing.createLicense({
          tier: 'nonexistent',
          customerId: 'x',
          customerEmail: 'x@x.com',
          customerName: 'X',
        });
      },
      { message: /Tier invalide/ }
    );
  });

  it('createLicense() devrait créer une licence sans expiration (illimitée)', async () => {
    const license = await licensing.createLicense({
      tier: 'enterprise',
      customerId: 'cust_unlimited',
      customerEmail: 'corp@dry.local',
      customerName: 'Corp',
      durationDays: 0,
    });
    assert.equal(license.expiresAt, null);
  });
});

describe('Licensing — Vérification de validité', () => {
  it('checkLicenseValidity() devrait valider une licence active et non expirée', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = licensing.checkLicenseValidity({
      status: 'active',
      expiresAt: future,
    });
    assert.equal(result.valid, true);
  });

  it('checkLicenseValidity() devrait invalider une licence expirée', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const result = licensing.checkLicenseValidity({
      status: 'active',
      expiresAt: past,
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'LICENSE_EXPIRED');
  });

  it('checkLicenseValidity() devrait invalider une licence révoquée', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = licensing.checkLicenseValidity({
      status: 'revoked',
      expiresAt: future,
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'LICENSE_REVOKED');
  });

  it('checkLicenseValidity() devrait retourner LICENSE_NOT_FOUND pour null', () => {
    const result = licensing.checkLicenseValidity(null);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'LICENSE_NOT_FOUND');
  });
});

describe('Licensing — Features par tier', () => {
  it('hasFeature() devrait donner les bonnes features pour Community', () => {
    assert.ok(licensing.hasFeature('community', 'api_basic'));
    assert.ok(licensing.hasFeature('community', 'docs_swagger'));
    assert.equal(licensing.hasFeature('community', 'monitoring'), false);
  });

  it('hasFeature() devrait donner les bonnes features pour Pro', () => {
    assert.ok(licensing.hasFeature('pro', 'api_full'));
    assert.ok(licensing.hasFeature('pro', 'monitoring'));
    assert.ok(licensing.hasFeature('pro', 'support_priority'));
    assert.equal(licensing.hasFeature('pro', 'sla_99_9'), false);
  });

  it('hasFeature() devrait donner toutes les features pour Enterprise', () => {
    assert.ok(licensing.hasFeature('enterprise', 'sla_99_9'));
    assert.ok(licensing.hasFeature('enterprise', 'support_dedicated_24_7'));
    assert.ok(licensing.hasFeature('enterprise', 'custom_deployment'));
  });

  it('hasFeature() devrait retourner false pour un tier inconnu', () => {
    assert.equal(licensing.hasFeature('unknown', 'api_basic'), false);
  });
});

describe('Licensing — Limites par tier', () => {
  it('checkLimit() devrait limiter Community à 100 req/h', () => {
    const result = licensing.checkLimit('community', 'maxRequestsPerHour', 50);
    assert.equal(result.allowed, true);
    assert.equal(result.limit, 100);
  });

  it('checkLimit() devrait bloquer Community au dessus de 100 req/h', () => {
    const result = licensing.checkLimit('community', 'maxRequestsPerHour', 150);
    assert.equal(result.allowed, false);
  });

  it('checkLimit() devrait donner illimité pour Enterprise', () => {
    const result = licensing.checkLimit('enterprise', 'maxRequestsPerHour', 999999);
    assert.equal(result.allowed, true);
    assert.equal(result.limit, Infinity);
  });

  it('checkLimit() devrait limiter Pro à 10 apps', () => {
    const result = licensing.checkLimit('pro', 'maxApps', 5);
    assert.equal(result.allowed, true);
    assert.equal(result.limit, 10);
  });
});

describe('Licensing — TIERS constants', () => {
  it('TIERS devrait contenir les 3 plans', () => {
    assert.ok(licensing.TIERS.community);
    assert.ok(licensing.TIERS.pro);
    assert.ok(licensing.TIERS.enterprise);
  });

  it('TIERS devrait définir les bons noms', () => {
    assert.equal(licensing.TIERS.community.name, 'Community');
    assert.equal(licensing.TIERS.pro.name, 'Pro');
    assert.equal(licensing.TIERS.enterprise.name, 'Enterprise');
  });

  it('TIERS devrait définir les bons niveaux de support', () => {
    assert.equal(licensing.TIERS.community.supportLevel, 'community');
    assert.equal(licensing.TIERS.pro.supportLevel, 'priority');
    assert.equal(licensing.TIERS.enterprise.supportLevel, 'dedicated');
  });
});
