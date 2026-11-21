const queryBuilder = require('../../../dry/middlewares/query/queryBuilder');

/** Chaîne thenable minimale reproduisant l'API d'une requête Mongoose. */
function requeteFactice(resultats = []) {
  const requete = Promise.resolve(resultats);
  for (const methode of ['select', 'sort', 'skip', 'limit', 'populate']) {
    requete[methode] = jest.fn(() => requete);
  }
  return requete;
}

function modeleFactice(resultats = []) {
  const requete = requeteFactice(resultats);
  return {
    schema: {
      paths: {
        titre: { instance: 'String' },
        contenu: { instance: 'String' },
        espaceId: { instance: 'ObjectId' },
        ordre: { instance: 'Number' },
      },
    },
    countDocuments: jest.fn(async () => resultats.length),
    find: jest.fn(() => requete),
    requete,
  };
}

describe('queryBuilder — isolation ACL', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { query: {}, params: {} };
    res = {};
    next = jest.fn();
  });

  it('conserve le $and de sécurité lors d’une recherche sans fields', async () => {
    const filtreAcl = { $and: [{ espaceId: { $in: ['espace-a'] } }] };
    req.query = { ...filtreAcl, search: 'objectif' };
    const modele = modeleFactice();

    await queryBuilder(modele)(req, res, next);

    const filtre = modele.countDocuments.mock.calls[0][0];
    expect(filtre.$and[0]).toEqual({ espaceId: { $in: ['espace-a'] } });
    expect(filtre.$and[1].$or).toEqual([
      { titre: { $regex: 'objectif', $options: 'i' } },
      { contenu: { $regex: 'objectif', $options: 'i' } },
    ]);
    expect(next).toHaveBeenCalled();
  });

  it('conserve le $and de sécurité lors d’une recherche avec fields', async () => {
    req.query = {
      $and: [{ espaceId: { $in: ['espace-a'] } }],
      search: 'objectif',
      fields: 'titre,espaceId',
    };
    const modele = modeleFactice();

    await queryBuilder(modele)(req, res, next);

    const filtre = modele.countDocuments.mock.calls[0][0];
    expect(filtre.$and[0]).toEqual({ espaceId: { $in: ['espace-a'] } });
    expect(filtre.$and[1].$or).toEqual([{ titre: { $regex: 'objectif', $options: 'i' } }]);
  });

  it('rejette un filtre json contenant un opérateur d’exécution', async () => {
    const modele = modeleFactice();
    req.query = { json: JSON.stringify({ $where: 'true' }) };

    await queryBuilder(modele)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(400);
    expect(modele.countDocuments).not.toHaveBeenCalled();
  });

  it('rejette un json invalide au lieu de l’ignorer silencieusement', async () => {
    req.query = { json: '{invalid' };
    await queryBuilder(modeleFactice())(req, res, next);
    expect(next.mock.calls[0][0].status).toBe(400);
  });

  it('transmet les erreurs de base au gestionnaire central', async () => {
    const modele = modeleFactice();
    modele.countDocuments.mockRejectedValue(new Error('base indisponible'));

    await queryBuilder(modele)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toContain('base indisponible');
    expect(res.advancedResults).toBeUndefined();
  });

  it('plafonne la pagination à 100', async () => {
    req.query = { limit: '5000' };
    const modele = modeleFactice();

    await queryBuilder(modele)(req, res, next);

    expect(modele.requete.limit).toHaveBeenCalledWith(100);
  });
});
