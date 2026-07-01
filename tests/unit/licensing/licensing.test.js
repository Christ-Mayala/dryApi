/**
 * Tests unitaires — Module Licensing
 */

const licensing = require('../../../dry/modules/licensing');

describe('Licensing — Génération de clés', () => {
  it('generateLicenseKey() devrait générer une clé au format DRY-XXXX-...', () => {
    const key = licensing.generateLicenseKey('pro', 'cust_123');
    expect(key).toMatch(/^DRY-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){5}$/);
  });

  it('generateLicenseKey() devrait produire des clés uniques', () => {
    const key1 = licensing.generateLicenseKey('community', 'a');
    const key2 = licensing.generateLicenseKey('community', 'a');
    expect(key1).not.toBe(key2);
  });

  it('generateLicenseKey() devrait fonctionner pour tous les tiers', () => {
    for (const tier of ['community', 'pro', 'enterprise']) {
      expect(licensing.generateLicenseKey(tier, 'test')).toMatch(/^DRY-/);
    }
  });
});

describe('Licensing — Validation de format', () => {
  it('validateLicenseFormat() devrait accepter une clé valide', () => {
    const key = licensing.generateLicenseKey('pro', 'cust_456');
    expect(licensing.validateLicenseFormat(key)).toBe(true);
  });

  it('validateLicenseFormat() devrait rejeter les formats invalides', () => {
    expect(licensing.validateLicenseFormat(null)).toBe(false);
    expect(licensing.validateLicenseFormat('')).toBe(false);
    expect(licensing.validateLicenseFormat('INVALID-KEY')).toBe(false);
    expect(licensing.validateLicenseFormat('DRY-XXXX')).toBe(false);
    expect(licensing.validateLicenseFormat(123)).toBe(false);
  });
});

describe('Licensing — Vérification de validité', () => {
  it('checkLicenseValidity() devrait valider une licence active non expirée', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = licensing.checkLicenseValidity({ status: 'active', expiresAt: future });
    expect(result.valid).toBe(true);
  });

  it('checkLicenseValidity() devrait invalider une licence expirée', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const result = licensing.checkLicenseValidity({ status: 'active', expiresAt: past });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('LICENSE_EXPIRED');
  });

  it('checkLicenseValidity() devrait invalider une licence révoquée', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = licensing.checkLicenseValidity({ status: 'revoked', expiresAt: future });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('LICENSE_REVOKED');
  });

  it('checkLicenseValidity() devrait retourner LICENSE_NOT_FOUND pour null', () => {
    const result = licensing.checkLicenseValidity(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('LICENSE_NOT_FOUND');
  });
});

describe('Licensing — Features par tier', () => {
  it('hasFeature() devrait donner les bonnes features pour Community', () => {
    expect(licensing.hasFeature('community', 'api_basic')).toBe(true);
    expect(licensing.hasFeature('community', 'monitoring')).toBe(false);
  });

  it('hasFeature() devrait donner les bonnes features pour Pro', () => {
    expect(licensing.hasFeature('pro', 'api_full')).toBe(true);
    expect(licensing.hasFeature('pro', 'monitoring')).toBe(true);
    expect(licensing.hasFeature('pro', 'sla_99_9')).toBe(false);
  });

  it('hasFeature() devrait donner toutes les features pour Enterprise', () => {
    expect(licensing.hasFeature('enterprise', 'sla_99_9')).toBe(true);
    expect(licensing.hasFeature('enterprise', 'support_dedicated_24_7')).toBe(true);
  });

  it('hasFeature() devrait retourner false pour un tier inconnu', () => {
    expect(licensing.hasFeature('unknown', 'api_basic')).toBe(false);
  });
});

describe('Licensing — TIERS constants', () => {
  it('TIERS devrait contenir les 3 plans', () => {
    expect(licensing.TIERS.community).toBeDefined();
    expect(licensing.TIERS.pro).toBeDefined();
    expect(licensing.TIERS.enterprise).toBeDefined();
  });

  it('TIERS devrait définir les bons noms', () => {
    expect(licensing.TIERS.community.name).toBe('Community');
    expect(licensing.TIERS.pro.name).toBe('Pro');
    expect(licensing.TIERS.enterprise.name).toBe('Enterprise');
  });
});
