jest.mock('../../../dry/utils/http/response');

const sendResponse = require('../../../dry/utils/http/response');
const acl = require('../../../dryApp/Nova/services/acl.service');

const WORKSPACE_A = '507f1f77bcf86cd799439001';
const WORKSPACE_B = '507f1f77bcf86cd799439002';
const ESPACE_A = '507f1f77bcf86cd799439011';
const ESPACE_B = '507f1f77bcf86cd799439012';

const utilisateurOrdinaire = { _id: 'u-user', role: 'user', email: 'user@nova.test' };
const proprietaire = { _id: 'u-owner', role: 'user', email: 'owner@nova.test' };

const TOUS_DROITS = { lecture: true, edition: true, commentaire: true, partage: true, admin: true };
const LECTURE_SEULE = {
  lecture: true,
  edition: false,
  commentaire: false,
  partage: false,
  admin: false,
};

/**
 * Construit une requête avec les appartenances NOVA chargées par `protect`.
 * `membres` est une liste de fiches { workspaceId, role, permissions, espaceIds }.
 */
function reqAvec({
  user = utilisateurOrdinaire,
  membres = [],
  workspaceId = WORKSPACE_A,
  ...reste
} = {}) {
  return {
    user,
    novaMembres: membres.map((m, i) => ({
      _id: `m-${i}`,
      workspaceId: m.workspaceId,
      role: m.role,
      permissions: m.permissions,
      espaceIds: m.espaceIds || [],
    })),
    headers: workspaceId ? { 'x-workspace-id': workspaceId } : {},
    query: {},
    params: {},
    body: {},
    ...reste,
  };
}

const membre = (role, workspaceId = WORKSPACE_A, permissions = undefined, espaceIds = []) => ({
  workspaceId,
  role,
  permissions,
  espaceIds,
});

describe('ACL NOVA — appartenance par espace de travail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuse l’administration à un compte sans appartenance', () => {
    const req = reqAvec();
    acl.exigerAdministrationNova(req, {}, () => {});
    expect(sendResponse).toHaveBeenCalledWith(
      {},
      null,
      'Action réservée aux administrateurs',
      false,
      undefined,
      403
    );
  });

  it('autorise le propriétaire et l’administrateur du workspace courant', () => {
    for (const role of ['proprietaire', 'admin']) {
      const next = jest.fn();
      acl.exigerAdministrationNova(reqAvec({ membres: [membre(role)] }), {}, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('ne déduit aucun privilège du rôle global ni des anciens champs nova*', () => {
    for (const roleGlobal of ['admin', 'superadmin']) {
      const req = reqAvec({ user: { _id: 'u-global', role: roleGlobal } });
      expect(acl.roleNova(req)).toBe('invite');
      expect(acl.peutAdministrerNova(req)).toBe(false);
      expect(acl.peutEditerNova(req)).toBe(false);
      expect(acl.idsEspacesAutorises(req)).toEqual([]);
    }

    const legacy = reqAvec({
      user: {
        _id: 'u-legacy',
        role: 'superadmin',
        novaRole: 'proprietaire',
        novaPermissions: TOUS_DROITS,
        novaEspaceIds: [ESPACE_A, ESPACE_B],
      },
    });
    expect(acl.permissionsNova(legacy)).toEqual({
      lecture: false,
      edition: false,
      commentaire: false,
      partage: false,
      admin: false,
    });
    expect(acl.peutAdministrerNova(legacy)).toBe(false);
  });

  it('donne au créateur d’un workspace les droits de propriétaire sur CE workspace uniquement', () => {
    const reqA = reqAvec({
      user: proprietaire,
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
      workspaceId: WORKSPACE_A,
    });
    expect(acl.roleNova(reqA)).toBe('proprietaire');
    expect(acl.estAdminNova(reqA)).toBe(true);
    expect(acl.idsEspacesAutorises(reqA)).toBeNull();

    // Le même compte, sans appartenance au workspace B, n'a aucun droit.
    const reqB = reqAvec({
      user: proprietaire,
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
      workspaceId: WORKSPACE_B,
    });
    expect(acl.roleNova(reqB)).toBe('invite');
    expect(acl.peutAdministrerNova(reqB)).toBe(false);
    expect(acl.peutLireNova(reqB)).toBe(false);
    expect(acl.idsEspacesAutorises(reqB)).toEqual([]);
  });

  it('applique la matrice propriétaire/admin/membre/invité/sans accès', () => {
    const cas = {
      proprietaire: {
        role: 'proprietaire',
        regles: { lire: true, editer: true, partager: true, administrer: true },
      },
      admin: {
        role: 'admin',
        regles: { lire: true, editer: true, partager: true, administrer: true },
      },
      membre: {
        role: 'membre',
        regles: { lire: true, editer: true, partager: false, administrer: false },
      },
      invite: {
        role: 'invite',
        regles: { lire: true, editer: false, partager: false, administrer: false },
      },
      sansAcces: {
        role: 'invite',
        permissions: { lecture: false },
        regles: { lire: false, editer: false, partager: false, administrer: false },
      },
    };

    for (const [nom, casCourant] of Object.entries(cas)) {
      const req = reqAvec({
        membres: [membre(casCourant.role, WORKSPACE_A, casCourant.permissions || undefined)],
      });
      expect({ nom, valeur: acl.peutLireNova(req) }).toEqual({
        nom,
        valeur: casCourant.regles.lire,
      });
      expect({ nom, valeur: acl.peutEditerNova(req) }).toEqual({
        nom,
        valeur: casCourant.regles.editer,
      });
      expect({ nom, valeur: acl.peutPartagerNova(req) }).toEqual({
        nom,
        valeur: casCourant.regles.partager,
      });
      expect({ nom, valeur: acl.peutAdministrerNova(req) }).toEqual({
        nom,
        valeur: casCourant.regles.administrer,
      });
    }
  });

  it('ignore un en-tête X-Workspace-Id qui ne correspond à aucune appartenance', () => {
    const req = reqAvec({
      user: proprietaire,
      membres: [membre('admin', WORKSPACE_A, TOUS_DROITS)],
      workspaceId: WORKSPACE_B,
    });
    expect(acl.estAdminNova(req)).toBe(false);
    expect(acl.permissionsNova(req)).toEqual({
      lecture: false,
      edition: false,
      commentaire: false,
      partage: false,
      admin: false,
    });
  });

  it('résout automatiquement le workspace unique quand aucun en-tête n’est envoyé', () => {
    const req = reqAvec({
      membres: [membre('membre', WORKSPACE_B, undefined, [ESPACE_B])],
      workspaceId: null,
    });
    expect(acl.roleNova(req)).toBe('membre');
    expect(acl.contexteDe(req).workspaceId).toBe(WORKSPACE_B);
  });

  it('applique les permissions fines et l’implication admin ⇒ tous droits', () => {
    const invite = reqAvec({ membres: [membre('invite')] });
    expect(acl.peutLireNova(invite)).toBe(true);
    expect(acl.peutEditerNova(invite)).toBe(false);
    expect(acl.peutCommenterNova(invite)).toBe(false);
    expect(acl.peutPartagerNova(invite)).toBe(false);

    const proprietaireReq = reqAvec({
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
    });
    expect(acl.permissionsNova(proprietaireReq)).toEqual(TOUS_DROITS);
  });

  it('refuse l’accès à un espace non attribué et refuse un espace d’un autre workspace', async () => {
    const membreReq = reqAvec({
      membres: [membre('membre', WORKSPACE_A, undefined, [ESPACE_A])],
      getModel: jest.fn(() => ({
        findById: jest.fn(() => ({
          select: jest.fn(() => ({ lean: async () => ({ workspaceId: WORKSPACE_A }) })),
        })),
      })),
    });
    expect(await acl.peutAccederEspace(membreReq, ESPACE_B)).toBe(false);
    expect(await acl.peutAccederEspace(membreReq, ESPACE_A)).toBe(true);

    const adminReq = reqAvec({
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
      getModel: jest.fn(() => ({
        findById: jest.fn(() => ({
          select: jest.fn(() => ({ lean: async () => ({ workspaceId: WORKSPACE_B }) })),
        })),
      })),
    });
    expect(await acl.peutAccederEspace(adminReq, ESPACE_B)).toBe(false);
  });

  it('fusionne les filtres sans écraser les paramètres de pagination', () => {
    const req = { query: { page: '2', $or: [{ titre: 'a' }] } };
    acl.fusionnerFiltre(req, { estpace: 'x' });
    expect(req.query.page).toBe('2');
    expect(req.query.$and).toEqual([{ $or: [{ titre: 'a' }] }, { estpace: 'x' }]);
  });

  it('bloque un accès inter-utilisateur sur une ressource personnelle', async () => {
    const req = reqAvec({
      membres: [membre('membre')],
      params: { id: 'n1' },
      getModel: jest.fn(() => ({
        findById: jest.fn(async () => ({ _id: 'n1', destinataireId: 'u-autre' })),
      })),
    });
    const next = jest.fn();
    await acl.exigerAccesRessource({
      modelName: 'Notification',
      proprieteProprietaire: 'destinataireId',
    })(req, {}, next);
    expect(sendResponse).toHaveBeenCalledWith(
      {},
      null,
      'Ressource appartenant à un autre utilisateur',
      false,
      undefined,
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('bloque un accès inter-espace même avec un identifiant valide', async () => {
    const req = reqAvec({
      membres: [membre('membre', WORKSPACE_A, undefined, [ESPACE_A])],
      params: { id: 'b1' },
      getModel: jest.fn(() => ({
        findById: jest.fn(() => ({
          select: jest.fn(() => ({
            lean: async () => ({ _id: 'b1', espaceId: ESPACE_B, workspaceId: WORKSPACE_B }),
          })),
        })),
      })),
    });
    const next = jest.fn();
    await acl.exigerAccesRessource({ modelName: 'Bloc' })(req, {}, next);
    expect(sendResponse).toHaveBeenCalledWith(
      {},
      null,
      'Ressource appartenant à un autre espace',
      false,
      undefined,
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('bloque une ressource dont le workspace diffère du workspace courant', async () => {
    const req = reqAvec({
      user: proprietaire,
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
      params: { id: 'b2' },
      getModel: jest.fn(() => ({
        findById: jest.fn(async () => ({
          _id: 'b2',
          workspaceId: WORKSPACE_B,
          espaceId: ESPACE_B,
        })),
      })),
    });
    const next = jest.fn();
    await acl.exigerAccesRessource({ modelName: 'Bloc' })(req, {}, next);
    expect(sendResponse).toHaveBeenCalledWith(
      {},
      null,
      'Ressource appartenant à un autre espace de travail',
      false,
      undefined,
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse au propriétaire le contenu privé d’un autre compte', async () => {
    const req = reqAvec({
      user: proprietaire,
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
      params: { id: 'c1' },
      getModel: jest.fn(() => ({
        findById: jest.fn(async () => ({
          _id: 'c1',
          section: 'prive',
          espaceId: ESPACE_A,
          createdBy: 'u-autre',
        })),
      })),
    });
    const next = jest.fn();
    await acl.exigerAccesRessource({ modelName: 'Commentaire' })(req, {}, next);
    expect(sendResponse).toHaveBeenCalledWith({}, null, 'Accès refusé', false, undefined, 403);
    expect(next).not.toHaveBeenCalled();
  });

  it('refuse une ressource orpheline à un lecteur qui n’en est pas le créateur', async () => {
    const req = reqAvec({
      membres: [membre('membre')],
      params: { id: 'o1' },
      getModel: jest.fn(() => ({
        findById: jest.fn(async () => ({ _id: 'o1', createdBy: 'u-autre' })),
      })),
    });
    const next = jest.fn();
    await acl.exigerAccesRessource({ modelName: 'Bloc' })(req, {}, next);
    expect(sendResponse).toHaveBeenCalledWith(
      {},
      null,
      'Ressource appartenant à un autre espace',
      false,
      undefined,
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('exige une référence explicite quand la ressource est configurée pour cela', async () => {
    const req = reqAvec({ user: { _id: 'u-member' }, membres: [membre('membre')], body: {} });
    const next = jest.fn();
    await acl.verifierPayloadAcces({ exigerReference: true })(req, {}, next);
    expect(sendResponse).toHaveBeenCalledWith(
      {},
      null,
      'Référence de page ou d’espace requise',
      false,
      undefined,
      400
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('résout un parentId selon le modèle de la route puis vérifie son espace', async () => {
    const req = reqAvec({
      user: { _id: 'u-member' },
      membres: [membre('membre', WORKSPACE_A, undefined, [ESPACE_A])],
      body: { parentId: 'b-parent' },
      getModel: jest.fn(() => ({
        findById: jest.fn(() => ({
          select: jest.fn(() => ({
            lean: async () => ({
              _id: 'b-parent',
              espaceId: ESPACE_A,
              workspaceId: WORKSPACE_A,
              createdBy: 'u-autre',
            }),
          })),
        })),
      })),
    });
    const next = jest.fn();
    await acl.verifierPayloadAcces({
      references: { parentId: 'Bloc' },
      exigerReference: true,
    })(req, {}, next);
    expect(req.getModel).toHaveBeenCalledWith('Bloc');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('exclut les pages privées des listes liées, même pour un propriétaire', async () => {
    const findPage = jest.fn(() => ({
      select: jest.fn(() => ({ lean: async () => [{ _id: 'p-autorisee' }] })),
    }));
    const findEspace = jest.fn(() => ({
      select: jest.fn(() => ({ lean: async () => [{ _id: ESPACE_A }] })),
    }));
    const req = reqAvec({
      user: proprietaire,
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
      getModel: jest.fn((nom) => ({ find: nom === 'Espace' ? findEspace : findPage })),
    });
    const next = jest.fn();
    await acl.filtrerParPages()(req, {}, next);
    expect(findPage).toHaveBeenCalledTimes(1);
    expect(findPage.mock.calls[0][0]).toEqual({
      workspaceId: WORKSPACE_A,
      $nor: [{ section: 'prive', createdBy: { $ne: 'u-owner' } }],
      $or: [{ espaceId: { $in: [ESPACE_A] } }, { createdBy: 'u-owner' }],
    });
    expect(req.query.$or).toEqual([{ pageId: { $in: ['p-autorisee'] } }, { createdBy: 'u-owner' }]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('filtre les espaces par workspace même pour un administrateur', async () => {
    const find = jest.fn(() => ({
      select: jest.fn(() => ({ lean: async () => [{ _id: ESPACE_A }] })),
    }));
    const req = reqAvec({
      user: proprietaire,
      membres: [membre('proprietaire', WORKSPACE_A, TOUS_DROITS)],
      getModel: jest.fn(() => ({ find })),
    });
    const next = jest.fn();
    await acl.filtrerEspacesMiddleware('espaceId')(req, {}, next);
    expect(find).toHaveBeenCalledWith({ workspaceId: WORKSPACE_A });
    expect(req.query.$or[0]).toEqual({ espaceId: { $in: [ESPACE_A] } });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
