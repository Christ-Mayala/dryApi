const sendResponse = require('../../../../../dry/utils/http/response');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const { estAdminNova, forcerFiltre } = require('../../../services/acl.service');
const WorkspacesSchema = require('../model/workspaces.schema');

/**
 * Nombre maximal d'espaces de travail qu'un utilisateur peut creer.
 * C'est bien CETTE limite qui vaut 5 (et non les espaces d'equipe, illimites).
 */
const MAX_WORKSPACES_PAR_UTILISATEUR = 5;

/** Nom de l'espace de travail créé automatiquement pour un nouveau compte. */
const NOM_ESPACE_PAR_DEFAUT = 'Mon Espace';

/**
 * Chaque utilisateur ne voit que ses propres espaces de travail. L'historique
 * d'acces total (via estAdminNova) ne s'applique pas aux workspaces : un admin
 * doit pouvoir gerer son propre espace sans voir ceux des membres invites.
 */
const filtrerListe = (req, res, next) => {
  forcerFiltre(req, { createdBy: req.user._id });
  next();
};

/**
 * Tout compte possede au moins un espace de travail, cree a la volee lors de
 * la premiere lecture. Sans cela, un compte existant n'aurait aucun espace de
 * travail et ne pourrait donc plus creer d'espace d'equipe (le contenu qu'il
 * voit etant du contenu historique sans rattachement).
 *
 * Regle : on ne cree l'espace par defaut que si l'utilisateur n'en a encore
 * AUCUN a son nom. Un admin qui voit les workspaces de toute la plateforme ne
 * doit pas se voir creer un espace supplementaire en doublon.
 */
const assurerEspaceParDefaut = async (req, res, next) => {
  try {
    if (!req.user?._id) return next();
    const Model = req.getModel('Workspace', WorkspacesSchema);
    // Toujours filtrer par createdBy (meme pour un admin) : on verifie
    // uniquement l'existence d'un espace appartenant a l'utilisateur.
    const existant = await Model.findOne({ createdBy: req.user._id }).select('_id').lean();
    if (existant) return next();
    // Aucun workspace a ce nom : on en cree un seul et unique.
    await Model.create({
      nom: NOM_ESPACE_PAR_DEFAUT,
      icone: '🏠',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
  } catch {
    // La creation de l'espace par defaut ne doit jamais bloquer la lecture.
  }
  return next();
};

/**
 * Interdit la lecture du detail d'un espace de travail par un non-proprietaire.
 * Laisse passer lorsque le document n'existe pas (le handler renvoie le 404).
 */
const verifierAccesWorkspace = async (req, res, next) => {
  if (estAdminNova(req.user)) return next();

  const Model = req.getModel('Workspace', WorkspacesSchema);
  const doc = await Model.findById(req.params.id).select('createdBy').lean();
  if (!doc) return next();
  if (String(doc.createdBy) === String(req.user._id)) return next();
  return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
};

/** Bloque la creation au-dela de 5 espaces de travail par utilisateur. */
const limiterWorkspaces = async (req, res, next) => {
  const Model = req.getModel('Workspace', WorkspacesSchema);
  // Comptage via find() pour respecter le soft-delete : un espace mis a la
  // corbeille libere un emplacement (countDocuments ignorerait ce filtre).
  const existants = await Model.find({ createdBy: req.user?._id ?? null }).select('_id').lean();
  if (existants.length >= MAX_WORKSPACES_PAR_UTILISATEUR) {
    return sendResponse(
      res,
      null,
      `Limite de ${MAX_WORKSPACES_PAR_UTILISATEUR} espaces de travail atteinte`,
      false,
      undefined,
      403
    );
  }
  return next();
};

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Creation ouverte aux membres connectes (5 espaces de travail maximum par
// utilisateur) ; isolation par proprietaire pour la lecture et la gestion.
module.exports = buildCrudRouter('Workspace', WorkspacesSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.workspaces.create,
    update: validateNova.workspaces.update,
  },
  middlewares: {
    create: [limiterWorkspaces],
    list: [assurerEspaceParDefaut, filtrerListe],
    get: [verifierAccesWorkspace],
    update: [verifierAccesWorkspace],
    delete: [verifierAccesWorkspace],
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
  },
});
