/**
 * Tests unitaires — Factory CRUD
 * @module tests/unit/factories/crudFactory.test
 */

const { describe, it, expect, beforeEach, jest } = require('@jest/globals');

describe('Factory CRUD', () => {
  let crudFactory;
  let mockModel;

  beforeEach(() => {
    jest.resetModules();

    mockModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    };

    jest.mock('express-async-handler', () => (fn) => fn);
    jest.mock('../../../dry/utils/http/response', () => ({
      __esModule: true,
      default: jest.fn(),
      paginated: jest.fn(),
    }));

    crudFactory = require('../../../dry/core/factories/crudFactory');
  });

  it('devrait créer des fonctions CRUD de base', () => {
    const crud = crudFactory(mockModel, {
      allowedFields: ['name', 'email'],
    });

    expect(crud).toHaveProperty('create');
    expect(crud).toHaveProperty('getAll');
    expect(crud).toHaveProperty('getById');
    expect(crud).toHaveProperty('update');
    expect(crud).toHaveProperty('delete');
  });

  it('devrait filtrer les champs autorisés dans create', async () => {
    const crud = crudFactory(mockModel, {
      allowedFields: ['name', 'email'],
    });

    mockModel.create.mockResolvedValue({
      _id: '123',
      name: 'Test',
      email: 'test@test.com',
    });

    // Simuler une requête
    const req = {
      body: { name: 'Test', email: 'test@test.com', role: 'admin' },
      user: { _id: 'user123' },
      getModel: jest.fn().mockReturnValue(mockModel),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await crud.create(req, res);

    // Vérifier que seuls les champs autorisés sont passés
    expect(mockModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test',
        email: 'test@test.com',
      })
    );
    // Le champ 'role' ne devrait pas être passé car non autorisé
    expect(mockModel.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' })
    );
  });

  it('devrait gérer les erreurs de création', async () => {
    const crud = crudFactory(mockModel, {
      allowedFields: ['name'],
    });

    mockModel.create.mockRejectedValue(new Error('Erreur DB'));

    const req = {
      body: { name: 'Test' },
      user: { _id: 'user123' },
      getModel: jest.fn().mockReturnValue(mockModel),
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await crud.create(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
