/**
 * Réparation automatique des appartenances historiques.
 *
 * Un compte créé avant la refonte workspace-scoped peut avoir un Workspace
 * sans fiche `Membre`. Sans réparation, le runtime fail-closed répond
 * « Accès refusé » à toutes les routes, y compris l'accueil.
 */

jest.mock('express', () => ({ Router: jest.fn(() => ({})) }));

jest.mock('../../../dry/core/factories/routerFactory', () => ({
  buildCrudRouter: jest.fn(() => require('express').Router()),
}));

jest.mock('../../../dryApp/Nova/validation/middleware', () => ({
  validateNova: { workspaces: { create: [], update: [] } },
}));

jest.mock('../../../dryApp/Nova/services/acl.service', () => ({ forcerFiltre: jest.fn() }));

jest.mock('../../../dryApp/Nova/features/membres/services/invitation.service', () => ({
  creerAppartenanceProprietaire: jest.fn(),
}));

jest.mock('../../../dry/utils/logging/logger', () => jest.fn());

jest.mock('../../../dryApp/Nova/features/workspaces/model/workspaces.schema', () => ({}));

const {
  creerAppartenanceProprietaire,
} = require('../../../dryApp/Nova/features/membres/services/invitation.service');
const logger = require('../../../dry/utils/logging/logger');
const routeur = require('../../../dryApp/Nova/features/workspaces/route/workspaces.routes');

const { assurerEspaceParDefaut, creerAppartenanceApresCreation } = routeur.__test;

const WORKSPACE = '507f1f77bcf86cd799439001';
const UTILISATEUR = '507f1f77bcf86cd799439021';

function reqAvec({ existant, membres = [] } = {}) {
  const workspace = { _id: WORKSPACE };
  const modele = {
    findOne: jest.fn(() => ({ select: () => ({ lean: async () => existant }) })),
    create: jest.fn(async () => workspace),
  };
  return {
    user: { _id: UTILISATEUR, email: 'owner@nova.test' },
    novaMembres: membres,
    novaContexte: { workspaceId: null, role: 'invite' },
    getModel: jest.fn(() => modele),
    modele,
  };
}

describe('workspaces.routes — réparation de l’appartenance propriétaire', () => {
  beforeEach(() => jest.clearAllMocks());

  it('répare un workspace historique sans fiche Membre', async () => {
    const appartenance = { workspaceId: WORKSPACE, role: 'proprietaire' };
    creerAppartenanceProprietaire.mockResolvedValue(appartenance);
    const req = reqAvec({ existant: { _id: WORKSPACE } });
    const next = jest.fn();

    await assurerEspaceParDefaut(req, {}, next);

    expect(next).toHaveBeenCalled();
    expect(creerAppartenanceProprietaire).toHaveBeenCalledWith({
      req,
      workspaceId: WORKSPACE,
      utilisateur: req.user,
    });
    expect(req.novaMembres).toEqual([appartenance]);
    expect(req.novaContexte).toBeUndefined();
    expect(req.modele.create).not.toHaveBeenCalled();
    expect(logger).not.toHaveBeenCalled();
  });

  it('crée un workspace par défaut quand le compte n’en a aucun', async () => {
    const appartenance = { workspaceId: WORKSPACE, role: 'proprietaire' };
    creerAppartenanceProprietaire.mockResolvedValue(appartenance);
    const req = reqAvec({ existant: null });

    await assurerEspaceParDefaut(req, {}, jest.fn());

    expect(req.modele.create).toHaveBeenCalledTimes(1);
    expect(creerAppartenanceProprietaire).toHaveBeenCalledTimes(1);
    expect(req.novaMembres).toEqual([appartenance]);
  });

  it('ne crée rien pour un compte déjà membre d’un workspace', async () => {
    const deja = { workspaceId: WORKSPACE, role: 'membre' };
    const req = reqAvec({ existant: null, membres: [deja] });

    await assurerEspaceParDefaut(req, {}, jest.fn());

    expect(creerAppartenanceProprietaire).not.toHaveBeenCalled();
    expect(req.modele.create).not.toHaveBeenCalled();
    expect(req.novaMembres).toEqual([deja]);
  });

  it('n’accorde aucun droit synthétique si la fiche n’a pas pu être persistée', async () => {
    creerAppartenanceProprietaire.mockResolvedValue(null);
    const req = reqAvec({ existant: { _id: WORKSPACE } });

    await assurerEspaceParDefaut(req, {}, jest.fn());

    expect(req.novaMembres).toEqual([]);
    expect(logger).toHaveBeenCalled();
  });

  it('crée la fiche propriétaire dès la création d’un workspace', async () => {
    const appartenance = { workspaceId: WORKSPACE, role: 'proprietaire' };
    creerAppartenanceProprietaire.mockResolvedValue(appartenance);
    const req = {
      user: { _id: UTILISATEUR, email: 'owner@nova.test' },
      getModel: jest.fn(() => ({ updateOne: jest.fn() })),
    };

    await creerAppartenanceApresCreation({ req, doc: { _id: WORKSPACE } });

    expect(creerAppartenanceProprietaire).toHaveBeenCalledWith({
      req,
      workspaceId: WORKSPACE,
      utilisateur: req.user,
    });
    expect(req.getModel).not.toHaveBeenCalled();
  });

  it('archive le workspace et propage l’erreur si l’appartenance échoue', async () => {
    creerAppartenanceProprietaire.mockResolvedValue(null);
    const updateOne = jest.fn();
    const req = {
      user: { _id: UTILISATEUR, email: 'owner@nova.test' },
      getModel: jest.fn(() => ({ updateOne })),
    };

    await expect(creerAppartenanceApresCreation({ req, doc: { _id: WORKSPACE } })).rejects.toThrow(
      'Appartenance propriétaire non persistée'
    );

    expect(updateOne).toHaveBeenCalledWith(
      { _id: WORKSPACE },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'deleted', updatedBy: UTILISATEUR }),
      })
    );
  });
});
