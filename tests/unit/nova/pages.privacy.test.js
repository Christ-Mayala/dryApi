/**
 * Invariants de confidentialité des pages NOVA.
 *
 * Ces tests ciblent les garde-fous qui empêchent une page privée (ou une
 * sous-page privée) d'être rattachée à un espace d'équipe, et la cascade de
 * suppression de franchir un workspace ou un créateur.
 */

jest.mock('../../../dryApp/Nova/services/acl.service', () => ({
  idsEspacesAutorises: jest.fn(() => null),
  forcerFiltre: jest.fn(),
  estAdminNova: jest.fn(() => true),
  exigerEditionNova: jest.fn((req, res, next) => next()),
  verifierPayloadAcces: jest.fn(() => (req, res, next) => next()),
  contexteDe: jest.fn(() => ({ workspaceId: 'wf1', role: 'proprietaire' })),
  filtrerWorkspace: jest.fn(),
}));

jest.mock('../../../dryApp/Nova/services/tempsReel.service', () => ({
  roomEquipe: jest.fn((id) => `equipe:${id}`),
  emettre: jest.fn(),
  notifierActiviteEquipe: jest.fn(async () => {}),
}));

jest.mock('../../../dry/core/factories/routerFactory', () => ({
  buildCrudRouter: jest.fn(() => require('express').Router()),
}));

jest.mock('../../../dry/middlewares/protection/auth.middleware', () => ({
  protect: jest.fn((req, res, next) => next()),
}));

jest.mock('../../../dry/middlewares/validation/validation.middleware', () => ({
  validateId: jest.fn((req, res, next) => next()),
}));

jest.mock('../../../dryApp/Nova/validation/middleware', () => ({
  validateNova: { pages: { create: [], update: [], delete: [] } },
}));

jest.mock('../../../dryApp/Nova/features/pages/model/pages.schema', () => ({}));
jest.mock('../../../dryApp/Nova/features/blocs/model/blocs.schema', () => ({}));

const routeur = require('../../../dryApp/Nova/features/pages/route/pages.routes');
const { normaliserPayloadPrive, cohererPageParent, verifierAccesPage, collecterIds } =
  routeur.__test;

const ESPACE_A = '507f1f77bcf86cd799439001';
const ESPACE_B = '507f1f77bcf86cd799439002';
const WORKSPACE_A = '507f1f77bcf86cd799439011';
const WORKSPACE_B = '507f1f77bcf86cd799439012';
const AUTEUR = '507f1f77bcf86cd799439021';
const AUTRE = '507f1f77bcf86cd799439022';

/** Chaîne Mongoose minimale : findById().select().lean(). */
function requeteUnique(resultat) {
  return {
    findById: jest.fn(() => ({ select: () => ({ lean: async () => resultat }) })),
  };
}

function reponseFactice() {
  return {
    statut: null,
    statutCode: null,
    status(code) {
      this.statutCode = code;
      return this;
    },
    json(corps) {
      this.statut = corps;
      return this;
    },
  };
}

describe('pages.routes — confidentialité des pages privées', () => {
  beforeEach(() => jest.clearAllMocks());

  it('force le workspace courant et retire tout espace d’une page privée', () => {
    const req = {
      body: { section: 'prive', espaceId: ESPACE_A, workspaceId: WORKSPACE_B },
    };
    const next = jest.fn();
    normaliserPayloadPrive(req, reponseFactice(), next);
    expect(next).toHaveBeenCalled();
    expect(req.body.espaceId).toBeNull();
    // Le workspace est imposé par le contexte ACL (mocké à `wf1`).
    expect(req.body.workspaceId).toBe('wf1');
  });

  it('une sous-page de page privée reste privée, sans espace, et vérifie le créateur', async () => {
    const req = {
      user: { _id: AUTEUR },
      body: { parentId: 'parent-prive', section: 'equipe', espaceId: ESPACE_A },
      getModel: jest.fn(() =>
        requeteUnique({
          section: 'prive',
          createdBy: AUTEUR,
          espaceId: null,
          workspaceId: WORKSPACE_A,
        })
      ),
    };
    const res = reponseFactice();
    const next = jest.fn();
    await cohererPageParent(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body.section).toBe('prive');
    expect(req.body.espaceId).toBeNull();
    expect(req.body.workspaceId).toBe(WORKSPACE_A);
  });

  it('refuse une sous-page privée sous une page d’équipe', async () => {
    const req = {
      user: { _id: AUTEUR },
      body: { parentId: 'parent-equipe', section: 'prive' },
      getModel: jest.fn(() =>
        requeteUnique({
          section: 'equipe',
          createdBy: AUTEUR,
          espaceId: ESPACE_A,
          workspaceId: WORKSPACE_A,
        })
      ),
    };
    const res = reponseFactice();
    const next = jest.fn();
    await cohererPageParent(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statutCode).toBe(400);
  });

  it('refuse une sous-page privée dont le créateur n’est pas l’utilisateur courant', async () => {
    const req = {
      user: { _id: AUTRE },
      body: { parentId: 'parent-prive', section: 'prive' },
      getModel: jest.fn(() =>
        requeteUnique({
          section: 'prive',
          createdBy: AUTEUR,
          espaceId: null,
          workspaceId: WORKSPACE_A,
        })
      ),
    };
    const res = reponseFactice();
    const next = jest.fn();
    await cohererPageParent(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statutCode).toBe(403);
  });

  it('confine la cascade de suppression à un même workspace et un même espace', async () => {
    const enfantsParNiveau = [
      [{ _id: 'enfant-a' }, { _id: 'enfant-etranger' }],
      [{ _id: 'petit-enfant-a' }],
      [],
    ];
    const find = jest.fn(() => ({
      select: () => ({ lean: async () => enfantsParNiveau.shift() ?? [] }),
    }));
    const Model = { find };
    const ids = await collecterIds(Model, 'racine', {
      workspaceId: WORKSPACE_A,
      espaceId: ESPACE_A,
    });
    expect(ids).toEqual(['racine', 'enfant-a', 'enfant-etranger', 'petit-enfant-a']);
    // Le filtre appliqué à chaque niveau porte bien le workspace et l'espace.
    for (const appel of find.mock.calls) {
      expect(appel[0].workspaceId).toBe(WORKSPACE_A);
      expect(appel[0].espaceId).toBe(ESPACE_A);
      expect(appel[0].includeDeleted).toBe(true);
    }
    expect(ESPACE_B).not.toBe(ESPACE_A);
  });

  it('confine la cascade privée au créateur et à l’absence d’espace', async () => {
    const find = jest.fn(() => ({ select: () => ({ lean: async () => [] }) }));
    await collecterIds({ find }, 'racine-privee', {
      workspaceId: WORKSPACE_A,
      section: 'prive',
      createdBy: AUTEUR,
    });
    const filtre = find.mock.calls[0][0];
    expect(filtre.workspaceId).toBe(WORKSPACE_A);
    expect(filtre.espaceId).toBeNull();
    expect(filtre.createdBy).toBe(AUTEUR);
  });

  it('autorise la mise à jour d’une page privée dont createdBy est populé', async () => {
    // Régression : les plugins DRY peuplent `createdBy` même sur `.lean()`.
    // `String({ _id })` donne `[object Object]` et refusait à tort le créateur.
    const req = {
      params: { id: 'page-privee' },
      user: { _id: AUTEUR },
      getModel: jest.fn(() =>
        requeteUnique({
          workspaceId: 'wf1',
          espaceId: null,
          createdBy: { _id: AUTEUR, email: 'owner@nova.test' },
          section: 'prive',
        })
      ),
    };
    const res = reponseFactice();
    const next = jest.fn();

    await verifierAccesPage(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statutCode).toBeNull();
  });

  it('refuse une page privée à un autre compte même administrateur du workspace', async () => {
    const req = {
      params: { id: 'page-privee' },
      user: { _id: AUTRE },
      getModel: jest.fn(() =>
        requeteUnique({
          workspaceId: 'wf1',
          espaceId: null,
          createdBy: { _id: AUTEUR, email: 'owner@nova.test' },
          section: 'prive',
        })
      ),
    };
    const res = reponseFactice();
    const next = jest.fn();

    await verifierAccesPage(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statutCode).toBe(403);
  });

  it('refuse une page appartenant à un autre workspace', async () => {
    const req = {
      params: { id: 'page-etrangere' },
      user: { _id: AUTEUR },
      getModel: jest.fn(() =>
        requeteUnique({
          workspaceId: WORKSPACE_B,
          espaceId: null,
          createdBy: AUTEUR,
          section: 'prive',
        })
      ),
    };
    const res = reponseFactice();
    const next = jest.fn();

    await verifierAccesPage(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statutCode).toBe(403);
  });
});
