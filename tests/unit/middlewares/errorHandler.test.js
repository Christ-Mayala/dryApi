/**
 * Tests unitaires — Gestionnaire d'erreurs
 * @module tests/unit/middlewares/errorHandler.test
 */

const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

describe('Gestionnaire d\'erreurs', () => {
  let errorHandler;
  let req;
  let res;

  beforeEach(() => {
    // Recharger le module à chaque test (pour éviter les caches)
    jest.resetModules();
    jest.mock('../../../dry/utils/logging/logger', () => jest.fn());
    jest.mock('../../../dry/services/alert/alert.service', () => ({
      sendAlert: jest.fn().mockResolvedValue(true),
      sanitizeValue: jest.fn((v) => v),
    }));

    errorHandler = require('../../../dry/middlewares/error/errorHandler');
    req = {
      method: 'GET',
      originalUrl: '/api/v1/test',
      headers: {},
      get: jest.fn().mockReturnValue(null),
      requestId: 'req-test-123',
      params: {},
      query: {},
      body: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      statusCode: 200,
      get: jest.fn(),
      setHeader: jest.fn(),
    };
  });

  it('devrait retourner une erreur 500 avec message par défaut', async () => {
    const err = new Error('Erreur interne');
    await errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('devrait retourner un message précis pour les erreurs de validation MongoDB', async () => {
    const err = {
      name: 'ValidationError',
      errors: {
        email: { kind: 'required', message: 'Le champ email est requis.' },
      },
    };
    await errorHandler(err, req, res, jest.fn());
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toContain('email');
  });

  it('devrait retourner un message clair pour les doublons (code 11000)', async () => {
    const err = { code: 11000, keyValue: { email: 'test@test.com' } };
    await errorHandler(err, req, res, jest.fn());
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toBe('Cet email est déjà utilisé.');
  });

  it('devrait retourner un message pour les tokens expirés', async () => {
    const err = { name: 'TokenExpiredError' };
    await errorHandler(err, req, res, jest.fn());
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toContain('Session invalide');
  });
});
