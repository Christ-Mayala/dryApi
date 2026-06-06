/**
 * Tests unitaires — Middleware d'authentification
 * @module tests/unit/middlewares/auth.test
 */

const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

// Mocker jsonwebtoken
jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const { protect, authorize } = require('../../../dry/middlewares/protection/auth.middleware');

describe('Middleware d\'authentification - protect', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {},
      getModel: jest.fn().mockReturnValue({
        findById: jest.fn().mockResolvedValue({
          _id: 'user123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'user',
          status: 'active',
        }),
      }),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('devrait rejeter une requête sans token', async () => {
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('devrait rejeter un token invalide', async () => {
    req.headers.authorization = 'Bearer invalid_token';
    jwt.verify = jest.fn().mockImplementation(() => { throw new Error('Invalid token'); });

    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('devrait accepter un token valide', async () => {
    req.headers.authorization = 'Bearer valid_token';
    jwt.verify = jest.fn().mockReturnValue({ id: 'user123', iat: 123, exp: 456 });

    await protect(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('devrait rejeter un compte désactivé (banned)', async () => {
    req.headers.authorization = 'Bearer valid_token';
    jwt.verify = jest.fn().mockReturnValue({ id: 'user123' });
    req.getModel = jest.fn().mockReturnValue({
      findById: jest.fn().mockResolvedValue({
        _id: 'user123',
        status: 'banned',
      }),
    });

    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Middleware d\'authentification - authorize', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { user: { role: 'user' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('devrait autoriser un utilisateur avec le bon rôle', () => {
    const middleware = authorize('user', 'admin');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('devrait refuser un utilisateur avec un mauvais rôle', () => {
    const middleware = authorize('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('devrait refuser si aucun utilisateur n\'est connecté', () => {
    req.user = undefined;
    const middleware = authorize('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
