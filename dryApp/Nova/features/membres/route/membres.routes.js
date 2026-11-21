const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const sendResponse = require('../../../../../dry/utils/http/response');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerAdministrationNova,
  filtrerEspacesMiddleware,
  filtrerWorkspaceMiddleware,
  estAdminNova,
  idsEspacesAutorises,
  contexteDe,
} = require('../../../services/acl.service');
const MembresSchema = require('../model/membres.schema');
const {
  notifierInvitationMembre,
  synchroniserAccesUtilisateur,
  revoquerAccesUtilisateur,
  normaliserPermissions,
} = require('../services/invitation.service');

/**
 * Déduit le statut d'un membre : « actif » lorsqu'un compte utilisateur existe
 * pour son adresse, « invité » sinon. Évite de stocker un statut qui se
 * désynchroniserait de la réalité des comptes.
 */
async function avecStatut({ req, doc }) {
  const objet = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  objet.statut = 'invite';
  if (Array.isArray(objet.espaceIds)) {
    objet.espaceIds = objet.espaceIds.map(String);
  }
  try {
    const User = req.getModel('User');
    const utilisateur = await User.findOne({ email: objet.email })
      .select('_id avatar avatarUrl name nom')
      .lean();
    if (utilisateur?._id) {
      objet.statut = 'actif';
      objet.utilisateurId = utilisateur._id;
      objet.avatarUrl = utilisateur.avatarUrl || utilisateur.avatar || null;
    }
  } catch (_) {
    /* jamais bloquant : le statut reste « invité » */
  }
  return objet;
}

/** Une fiche membre n'est visible que dans le workspace courant. */
async function verifierAccesMembre(req, res, next) {
  const contexte = contexteDe(req);
  const Membre = req.getModel('Membre', MembresSchema);
  const membre = await Membre.findById(req.params.id).select('workspaceId espaceIds').lean();
  if (!membre) return sendResponse(res, null, 'Membre introuvable', false, undefined, 404);
  if (contexte.workspaceId && String(membre.workspaceId) !== contexte.workspaceId) {
    return sendResponse(res, null, 'Membre appartenant à un autre espace de travail', false, undefined, 403);
  }
  if (estAdminNova(req)) return next();
  const autorises = (idsEspacesAutorises(req) || []).map(String);
  const accessible = (membre.espaceIds || []).some((id) => autorises.includes(String(id)));
  if (!accessible) {
    return sendResponse(res, null, 'Membre non autorisé', false, undefined, 403);
  }
  return next();
}

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture filtrée par espace ; écriture réservée à l'administration NOVA.
const router = buildCrudRouter('Membre', MembresSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.membres.create,
    update: validateNova.membres.update,
  },
  middlewares: {
    list: [filtrerWorkspaceMiddleware(), filtrerEspacesMiddleware('espaceIds')],
    get: [verifierAccesMembre],
    create: [exigerAdministrationNova],
    update: [exigerAdministrationNova],
    delete: [exigerAdministrationNova],
  },
  crudOptions: {
    populateFields: '',
    transformInput: async ({ req, mode, payload }) => {
      if (payload.email) payload.email = String(payload.email).trim().toLowerCase();
      if (req.user?._id) {
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
      }
      // Le workspace est imposé par le contexte courant : un client ne peut
      // pas inviter quelqu'un dans un workspace qu'il n'administre pas.
      const contexte = contexteDe(req);
      if (!contexte.workspaceId) {
        throw httpError('Espace de travail courant requis', 400);
      }
      if (mode === 'create') {
        payload.workspaceId = contexte.workspaceId;
      } else {
        delete payload.workspaceId;
      }
      if (mode === 'create' && payload.email) {
        const Membre = req.getModel('Membre', MembresSchema);
        const existe = await Membre.findOne({ workspaceId: contexte.workspaceId, email: payload.email }).lean();
        if (existe) throw httpError('Cette adresse est déjà membre ou invitée dans cet espace de travail', 409);
      }

      // Permissions : déduites du rôle par défaut, personnalisables. Un
      // changement de rôle sans permissions explicites réinitialise les accès
      // du nouveau rôle (une rétrogradation révoque donc bien les droits).
      if (mode === 'create') {
        payload.role = payload.role || 'membre';
        if (payload.role === 'proprietaire' && contexte.role !== 'proprietaire') {
          throw httpError('Seul le propriétaire peut déléguer un rôle de propriétaire', 403);
        }
        payload.permissions = normaliserPermissions(payload.role, payload.permissions);
      } else if (mode === 'update' && (payload.role || payload.permissions)) {
        const Membre = req.getModel('Membre', MembresSchema);
        const actuel = await Membre.findById(req.params.id).lean();
        if (actuel?.role === 'proprietaire' && contexte.role !== 'proprietaire') {
          throw httpError('Le propriétaire ne peut être modifié que par lui-même', 403);
        }
        const role = payload.role || actuel?.role || 'membre';
        if (role === 'proprietaire' && contexte.role !== 'proprietaire') {
          throw httpError('Seul le propriétaire peut promouvoir un propriétaire', 403);
        }
        payload.permissions = normaliserPermissions(role, payload.permissions);
      }
      return payload;
    },
    transformOutput: avecStatut,
    // Invitation : notifie par e-mail la personne nouvellement ajoutée, puis
    // synchronise le compte utilisateur avec le rôle/permissions du membre.
    afterCreate: async ({ req, doc }) => {
      await notifierInvitationMembre({ req, membre: doc });
      await synchroniserAccesUtilisateur({ req, membre: doc });
    },
    // Toute modification de rôle/permissions est répercutée sur le compte.
    afterUpdate: async ({ req, doc }) => {
      await synchroniserAccesUtilisateur({ req, membre: doc });
    },
    // Retrait d'un membre : révocation immédiate des droits NOVA sur le compte.
    afterDelete: async ({ req, doc }) => {
      await revoquerAccesUtilisateur({ req, membre: doc });
    },
  },
});

/**
 * POST /membres/:id/renvoyer-invitation
 * Réexpédie l'e-mail d'invitation d'un membre. Le mot de passe provisoire est
 * régénéré afin de garantir que les identifiants reçus sont valides (utile
 * lorsque le premier e-mail n'a pas été reçu).
 */
router.post('/:id/renvoyer-invitation', validateId, protect, exigerAdministrationNova, async (req, res) => {
  const Membre = req.getModel('Membre', MembresSchema);
  const membre = await Membre.findById(req.params.id);
  if (!membre) return sendResponse(res, null, 'Membre introuvable', false, undefined, 404);

  const envoye = await notifierInvitationMembre({ req, membre, regenererMotDePasse: true });
  return sendResponse(
    res,
    { envoye },
    envoye ? 'Invitation renvoyée' : "Invitation renvoyée, mais l'e-mail n'a pas pu être expédié",
    true,
  );
});

module.exports = router;
