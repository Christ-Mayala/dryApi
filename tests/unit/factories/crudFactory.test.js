/**
 * Tests unitaires — Factory CRUD
 * @module tests/unit/factories/crudFactory.test
 */

// Mocker les dépendances
jest.mock('express-async-handler', () => (fn) => fn);
jest.mock('../../../dry/utils/http/response');

const sendResponse = require('../../../dry/utils/http/response');
const { crudFactory } = require('../../../dry/core/factories/crudFactory');

describe('Factory CRUD', () => {
  let mockModel;

  beforeEach(() => {
    jest.clearAllMocks();
    mockModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    };
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
});
