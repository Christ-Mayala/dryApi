/**
 * Tests unitaires — Logger (Winston)
 * @module tests/unit/utils/logger.test
 */


describe('Logger (Winston)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('devrait charger la configuration Winston sans erreur', () => {
    const { logger } = require('../../../dry/config/logger.config');
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
  });

  it('devrait créer un logger de service contextualisé', () => {
    const { logger } = require('../../../dry/config/logger.config');
    const serviceLogger = logger.createServiceLogger('test-service');

    expect(serviceLogger).toBeDefined();
    expect(serviceLogger.info).toBeDefined();
    expect(serviceLogger.error).toBeDefined();
  });

  it('devrait logger sans erreur', () => {
    const { logger } = require('../../../dry/config/logger.config');
    expect(() => {
      logger.info('Test message');
      logger.error('Test error');
      logger.warn('Test warning');
    }).not.toThrow();
  });

  it('devrait exposer la fonction maskSensitiveData', () => {
    const { maskSensitiveData } = require('../../../dry/config/logger.config');
    expect(maskSensitiveData).toBeDefined();
    expect(typeof maskSensitiveData).toBe('function');
  });

  it('devrait masquer les mots de passe dans les objets', () => {
    const { maskSensitiveData } = require('../../../dry/config/logger.config');

    const sensitive = {
      name: 'Test',
      password: 'secret123',
      token: 'abc.def.ghi',
      nested: {
        apiKey: 'sk-test-123',
        normal: 'visible',
      },
    };

    const result = maskSensitiveData(sensitive);
    expect(result.name).toBe('Test');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.nested.apiKey).toBe('[REDACTED]');
    expect(result.nested.normal).toBe('visible');
  });
});
