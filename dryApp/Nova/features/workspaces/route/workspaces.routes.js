const sendResponse = require('../../../../../dry/utils/http/response');
const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const { forcerFiltre } = require('../../../services/acl.service');
const { creerAppartenanceProprietaire } = require('../../membres/services/invitation.service');
const logger = require('../../../../../dry/utils/logging/logger');
const WorkspacesSchema = require('../model/workspaces.schema');

/**
 * Nombre maximal d'espaces de travail qu'un utilisateur peut creer.
 * C'est bien CETTE limite qui vaut 5 (et non les espaces d'equipe, illimites).
 */
const MAX_WORKSPACES_PAR_UTILISATEUR = 5;

/** Nom de l'espace de travail créé automatiquement pour un nouveau compte. */
const NOM_ESPACE_PAR_DEFAUT = 'Mon Espace';

/** Identifiants des workspaces auxquels le compte appartient. */
function workspacesDe(req) {
  return (Array.isArray(req.novaMembres) ? req.novaMembres : [])
    .map((m) => (m.workspaceId ? String(m.workspaceId._id || m.workspaceId) : null))
    .filter(Boolean);
}

/**
 * Chaque utilisateur ne voit que les espaces de travail auxquels il appartient,
 * qu'il en soit propriétaire, admin ou simple membre. Aucun rôle global n'est
 * consulté : un propriétaire ici n'est pas propriétaire ailleurs.
 */
const filtrerListe = (req, res, next) => {
  forcerFiltre(req, { _id: { $in: workspacesDe(req) } });
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
    const appartenances = Array.isArray(req.novaMembres) ? req.novaMembres : [];
    // Un compte invité ailleurs possède déjà des droits : aucun espace par
    // défaut ne doit lui être créé en doublon.
    if (appartenances.length > 0) return next();

    const Model = req.getModel('Workspace', WorkspacesSchema);
    // Toujours filtrer par createdBy (meme pour un admin) : on verifie
    // uniquement l'existence d'un espace appartenant a l'utilisateur.
    const existant = await Model.findOne({ createdBy: req.user._id }).select('_id').lean();

    let workspaceId = existant?._id ?? null;
    if (!workspaceId) {
      // Aucun workspace : on en crée un seul et unique.
      const workspace = await Model.create({
        nom: NOM_ESPACE_PAR_DEFAUT,
        icone: '🏠',
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      workspaceId = workspace._id;
    }

    // Cas historique fréquent : le workspace existe (données d'avant la
    // refonte) mais aucune fiche Membre n'a jamais été créée. Le runtime est
    // fail-closed : sans cette réparation, le compte reste « Accès refusé »
    // sur toutes les routes, y compris l'accueil.
    const appartenance = await creerAppartenanceProprietaire({
      req,
      workspaceId,
      utilisateur: req.user,
    });
    if (!appartenance) {
      logger(
        `[NOVA] Impossible de créer l'appartenance propriétaire du workspace ${workspaceId}`,
        'error'
      );
      return next();
    }

    // On n'ajoute que l'appartenance réellement persistée : une fiche
    // synthétique donnerait l'illusion de droits que la requête suivante
    // (qui recharge `req.novaMembres` depuis la base) ne retrouverait pas.
    req.novaMembres = [...appartenances, appartenance];
    // Sécurité : si un middleware intermédiaire a déjà résolu un contexte
    // vide, on le purge pour que l'ACL voie la fiche fraîchement créée.
    delete req.novaContexte;
  } catch (erreur) {
    // La réparation ne bloque pas la lecture, mais l'échec est tracé :
    // un silence total masquerait une panne d'accès à la base.
    logger(`[NOVA] Échec réparation workspace/apartenance : ${erreur.message}`, 'error');
  }
  return next();
};

/**
 * Vérifie l'appartenance au workspace visé. La lecture est ouverte à tout
 * membre ; la gestion est réservée à son propriétaire ou à ses administrateurs.
 * Aucun droit n'est déduit du rôle global ni de `createdBy`.
 */
const verifierAccesWorkspace =
  (gestion = false) =>
  async (req, res, next) => {
    const membre = (Array.isArray(req.novaMembres) ? req.novaMembres : []).find(
      (m) => String(m.workspaceId?._id || m.workspaceId) === String(req.params.id)
    );
    if (!membre) {
      return sendResponse(res, null, 'Accès refusé', false, undefined, 403);
    }
    if (gestion && !['proprietaire', 'admin'].includes(membre.role)) {
      return sendResponse(
        res,
        null,
        'Gestion réservée au propriétaire ou à un administrateur',
        false,
        undefined,
        403
      );
    }
    return next();
  };

/** Bloque la creation au-dela de 5 espaces de travail par utilisateur. */
const limiterWorkspaces = async (req, res, next) => {
  const Model = req.getModel('Workspace', WorkspacesSchema);
  // Comptage via find() pour respecter le soft-delete : un espace mis a la
  // corbeille libere un emplacement (countDocuments ignorerait ce filtre).
  const existants = await Model.find({ createdBy: req.user?._id ?? null })
    .select('_id')
    .lean();
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

/**
 * Toute création de workspace doit rendre son auteur propriétaire de CE
 * workspace. L'effet est critique : sans fiche `Membre` persistée, l'espace
 * créé serait invisible dans la liste et toutes les routes répondraient
 * « Accès refusé ». En cas d'échec, le workspace tout juste créé est archivé
 * pour ne pas laisser un espace orphelin, puis l'erreur est propagée.
 */
async function creerAppartenanceApresCreation({ req, doc }) {
  try {
    const appartenance = await creerAppartenanceProprietaire({
      req,
      workspaceId: doc._id,
      utilisateur: req.user,
    });
    if (!appartenance) {
      throw new Error('Appartenance propriétaire non persistée');
    }
  } catch (erreur) {
    const Workspace = req.getModel('Workspace', WorkspacesSchema);
    await Workspace.updateOne(
      { _id: doc._id },
      { $set: { status: 'deleted', deletedAt: new Date(), updatedBy: req.user?._id } }
    );
    throw erreur;
  }
}

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
    get: [verifierAccesWorkspace()],
    update: [verifierAccesWorkspace(true)],
    delete: [verifierAccesWorkspace(true)],
  },
  crudOptions: {
    populateFields: '',
    effetsCritiques: ['afterCreate'],
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
      }
      return payload;
    },
    // Créer un workspace rend son auteur propriétaire de CE workspace.
    afterCreate: creerAppartenanceApresCreation,
  },
});

/** Accès ciblé aux réparations d'appartenance pour les tests unitaires. */
module.exports.__test = { assurerEspaceParDefaut, creerAppartenanceApresCreation };
