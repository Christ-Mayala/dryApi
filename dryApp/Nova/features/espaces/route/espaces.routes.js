const sendResponse = require('../../../../../dry/utils/http/response');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  idsEspacesAutorises,
  forcerFiltre,
  estAdminNova,
  contexteDe,
} = require('../../../services/acl.service');
const EspacesSchema = require('../model/espaces.schema');

/**
 * Restreint la liste aux espaces attribués lorsque l'utilisateur n'est pas
 * administrateur (isolation serveur ; le filtrage client devient une simple
 * redondance).
 */
const filtrerListe = (req, res, next) => {
  const contexte = contexteDe(req);
  const filtre = contexte.workspaceId ? { workspaceId: contexte.workspaceId } : { _id: { $in: [] } };
  const ids = idsEspacesAutorises(req);
  if (ids !== null) filtre._id = { $in: ids };
  forcerFiltre(req, filtre);
  next();
};

/**
 * Interdit la lecture du détail d'un espace hors du workspace courant ou hors
 * du périmètre du membre. Laisse passer si le document n'existe pas (404).
 */
const verifierAccesEspace = async (req, res, next) => {
  const contexte = contexteDe(req);
  const Model = req.getModel('Espace', EspacesSchema);
  const doc = await Model.findById(req.params.id).select('workspaceId').lean();
  if (!doc) return next();
  if (contexte.workspaceId && String(doc.workspaceId) !== contexte.workspaceId) {
    return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
  }
  const ids = idsEspacesAutorises(req);
  if (ids !== null && !ids.includes(String(doc._id))) {
    return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
  }
  return next();
};

/**
 * Gestion d'un espace d'équipe : propriétaire/admin du workspace courant, ou
 * auteur de l'espace disposant du droit d'édition. Aucun rôle global n'entre
 * en ligne de compte.
 */
const verifierGestionEspace = async (req, res, next) => {
  const contexte = contexteDe(req);
  const Model = req.getModel('Espace', EspacesSchema);
  const doc = await Model.findById(req.params.id).select('workspaceId createdBy').lean();
  if (!doc) return next(); // le handler renverra le 404
  if (contexte.workspaceId && String(doc.workspaceId) !== contexte.workspaceId) {
    return sendResponse(res, null, 'Espace appartenant à un autre espace de travail', false, undefined, 403);
  }
  if (estAdminNova(req)) return next();
  if (String(doc.createdBy) === String(req.user?._id)) return next();
  return sendResponse(res, null, 'Action réservée au propriétaire ou à un administrateur', false, undefined, 403);
};

/**
 * Un espace ne peut être rattaché qu'au workspace courant, auquel le compte
 * doit appartenir. Le client ne peut pas choisir un autre workspace.
 */
const verifierWorkspacePayload = (req, res, next) => {
  const contexte = contexteDe(req);
  if (!contexte.workspaceId) {
    return sendResponse(res, null, 'Espace de travail courant requis', false, undefined, 400);
  }
  req.body = { ...(req.body || {}), workspaceId: contexte.workspaceId };
  return next();
};

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture reservee aux membres connectes (et filtree par espace) ; creation
// ouverte aux membres (nombre illimite : la limite de 5 porte sur les espaces
// de travail, pas sur les espaces d'equipe) ; modification et suppression
// ouvertes au proprietaire NOVA (ou auteur de l'espace).
module.exports = buildCrudRouter('Espace', EspacesSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.espaces.create,
    update: validateNova.espaces.update,
  },
  middlewares: {
    list: [filtrerListe],
    get: [verifierAccesEspace],
    create: [verifierWorkspacePayload],
    update: [verifierWorkspacePayload, verifierGestionEspace],
    delete: [verifierGestionEspace],
  },
  crudOptions: {
    populateFields: '',
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
      }
      return payload;
    },
    // Le créateur d'un espace d'équipe y gagne l'accès dans SA fiche membre du
    // workspace courant. Aucun champ global du compte n'est modifié.
    afterCreate: async ({ req, doc }) => {
      const contexte = contexteDe(req);
      if (!contexte.membershipId) return;
      const Membre = req.getModel('Membre');
      await Membre.findByIdAndUpdate(contexte.membershipId, {
        $addToSet: { espaceIds: doc._id },
      });
    },
  },
});
