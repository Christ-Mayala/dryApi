const sendResponse = require('../../../../../dry/utils/http/response');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const { idsEspacesAutorises, forcerFiltre, peutAdministrerNova } = require('../../../services/acl.service');
const EspacesSchema = require('../model/espaces.schema');

/**
 * Restreint la liste aux espaces attribués lorsque l'utilisateur n'est pas
 * administrateur (isolation serveur ; le filtrage client devient une simple
 * redondance).
 */
const filtrerListe = (req, res, next) => {
  const ids = idsEspacesAutorises(req.user);
  if (ids !== null) forcerFiltre(req, { _id: { $in: ids } });
  next();
};

/**
 * Interdit la lecture du détail d'un espace hors du périmètre autorisé.
 * Laisse passer lorsque le document n'existe pas (le handler renvoie le 404).
 */
const verifierAccesEspace = async (req, res, next) => {
  const ids = idsEspacesAutorises(req.user);
  if (ids === null) return next();

  const Model = req.getModel('Espace', EspacesSchema);
  const doc = await Model.findById(req.params.id).select('_id').lean();
  if (!doc) return next();
  if (!ids.includes(String(doc._id))) {
    return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
  }
  return next();
};

/**
 * Autorise la mise a jour ou la suppression d'un espace par un administrateur
 * NOVA (ou compte proprietaire autonome), sinon par l'auteur de l'espace. Un
 * membre invite ne peut donc pas toucher aux espaces des autres.
 */
const verifierGestionEspace = async (req, res, next) => {
  if (peutAdministrerNova(req.user)) return next();

  const Model = req.getModel('Espace', EspacesSchema);
  const doc = await Model.findById(req.params.id).select('createdBy').lean();
  if (!doc) return next(); // le handler renverra le 404
  if (String(doc.createdBy) === String(req.user._id)) return next();
  return sendResponse(res, null, 'Action réservée au propriétaire ou à un administrateur', false, undefined, 403);
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
    update: [verifierGestionEspace],
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
    // Un membre restreint (`novaEspaceIds` défini) doit pouvoir utiliser
    // l'espace qu'il vient de créer : on l'ajoute à son périmètre autorisé,
    // faute de quoi l'isolation serveur le lui masquerait aussitôt.
    afterCreate: async ({ req, doc }) => {
      const utilisateur = req.user;
      if (!utilisateur || !Array.isArray(utilisateur.novaEspaceIds)) return;
      const User = req.getModel('User');
      await User.findByIdAndUpdate(utilisateur._id, {
        $addToSet: { novaEspaceIds: doc._id },
      });
    },
  },
});
