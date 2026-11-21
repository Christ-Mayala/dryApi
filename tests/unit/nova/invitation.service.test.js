jest.mock('../../../dry/services/auth/email.service', () => ({
  envoyerEmail: jest.fn(async () => true),
}));
jest.mock('../../../dryApp/Nova/features/parametres/services/notifications.service', () => ({
  notificationsEmailActives: jest.fn(() => false),
}));

const {
  synchroniserAccesUtilisateur,
  revoquerAccesUtilisateur,
  creerAppartenanceProprietaire,
} = require('../../../dryApp/Nova/features/membres/services/invitation.service');

const WORKSPACE_A = '507f1f77bcf86cd799439001';

function utilisateurFactice(surcharges = {}) {
  return {
    _id: 'u1',
    role: 'admin',
    nom: 'Admin global',
    email: 'owner@nova.test',
    novaRole: 'admin',
    novaPermissions: {
      lecture: true,
      edition: true,
      commentaire: true,
      partage: true,
      admin: true,
    },
    novaEspaceIds: ['e1'],
    save: jest.fn(async () => {}),
    ...surcharges,
  };
}

describe('invitation.service — appartenances workspace-scoped', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lie la fiche membre au compte sans écrire de droits sur le compte global', async () => {
    const utilisateur = utilisateurFactice();
    const findByIdAndUpdate = jest.fn(async () => ({}));
    const req = {
      getModel: jest.fn(() => ({
        findOne: jest.fn(() => ({ select: async () => utilisateur })),
        findByIdAndUpdate,
      })),
    };

    const modifie = await synchroniserAccesUtilisateur({
      req,
      membre: { _id: 'm1', email: 'membre@example.test', role: 'invite' },
    });

    expect(modifie).toBe(true);
    expect(findByIdAndUpdate).toHaveBeenCalledWith('m1', {
      $set: { utilisateurId: 'u1' },
    });
    // Le rôle DRY et les anciens champs nova* ne sont pas modifiés.
    expect(utilisateur.role).toBe('admin');
    expect(utilisateur.novaRole).toBe('admin');
    expect(utilisateur.novaEspaceIds).toEqual(['e1']);
    expect(utilisateur.save).not.toHaveBeenCalled();
  });

  it('ne lie rien lorsqu’aucun compte ne correspond à l’e-mail', async () => {
    const req = {
      getModel: jest.fn(() => ({
        findOne: jest.fn(() => ({ select: async () => null })),
        findByIdAndUpdate: jest.fn(),
      })),
    };
    const modifie = await synchroniserAccesUtilisateur({
      req,
      membre: { _id: 'm1', email: 'inconnu@example.test' },
    });
    expect(modifie).toBe(false);
    expect(req.getModel.mock.results[0].value.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('révoque l’accès dans le workspace de la fiche sans toucher au compte', async () => {
    const utilisateur = utilisateurFactice({ role: 'superadmin' });
    const findByIdAndUpdate = jest.fn(async () => ({}));
    const req = {
      getModel: jest.fn(() => ({ findByIdAndUpdate })),
    };
    const modifie = await revoquerAccesUtilisateur({
      req,
      membre: { _id: 'm1', email: 'ancien@example.test', utilisateurId: 'u1' },
    });

    expect(modifie).toBe(true);
    const [id, miseAJour] = findByIdAndUpdate.mock.calls[0];
    expect(id).toBe('m1');
    expect(miseAJour.$set.role).toBe('invite');
    expect(miseAJour.$set.espaceIds).toEqual([]);
    expect(miseAJour.$set.permissions).toEqual({
      lecture: true,
      edition: false,
      commentaire: false,
      partage: false,
      admin: false,
    });
    expect(utilisateur.role).toBe('superadmin');
    expect(utilisateur.novaRole).toBe('admin');
    expect(utilisateur.save).not.toHaveBeenCalled();
  });

  it('crée l’appartenance propriétaire d’un workspace pour le créateur', async () => {
    const utilisateur = utilisateurFactice({ role: 'user' });
    const create = jest.fn(async (doc) => doc);
    const req = {
      getModel: jest.fn(() => ({
        findOne: jest.fn(() => ({ lean: async () => null })),
        create,
      })),
    };

    const membre = await creerAppartenanceProprietaire({
      req,
      workspaceId: WORKSPACE_A,
      utilisateur,
    });

    expect(membre.role).toBe('proprietaire');
    expect(membre.workspaceId).toBe(WORKSPACE_A);
    expect(membre.email).toBe('owner@nova.test');
    expect(membre.permissions.admin).toBe(true);
    expect(utilisateur.role).toBe('user');
    expect(utilisateur.novaRole).toBe('admin');
    expect(utilisateur.save).not.toHaveBeenCalled();
  });

  it('est idempotente : ne remplace pas une appartenance existante', async () => {
    const utilisateur = utilisateurFactice();
    const existant = { _id: 'm-existant', role: 'proprietaire' };
    const create = jest.fn();
    const req = {
      getModel: jest.fn(() => ({
        findOne: jest.fn(() => ({ lean: async () => existant })),
        create,
      })),
    };

    const membre = await creerAppartenanceProprietaire({
      req,
      workspaceId: WORKSPACE_A,
      utilisateur,
    });

    expect(membre).toBe(existant);
    expect(create).not.toHaveBeenCalled();
  });
});
