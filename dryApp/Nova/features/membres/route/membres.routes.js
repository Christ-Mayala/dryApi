const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const sendResponse = require('../../../../../dry/utils/http/response');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateNova } = require('../../../validation/middleware');
const { exigerAdministrationNova } = require('../../../services/acl.service');
const MembresSchema = require('../model/membres.schema');
const {
  notifierInvitationMembre,
  synchroniserAccesUtilisateur,
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

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Liste réservée aux utilisateurs connectés ; écriture au propriétaire ou à un
// administrateur.
const router = buildCrudRouter('Membre', MembresSchema, {
  auth: { list: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.membres.create,
    update: validateNova.membres.update,
  },
  middlewares: {
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
      if (mode === 'create' && payload.email) {
        const Membre = req.getModel('Membre', MembresSchema);
        const existe = await Membre.findOne({ email: payload.email }).lean();
        if (existe) throw httpError('Cette adresse est déjà membre ou invitée', 409);
      }

      // Permissions : déduites du rôle par défaut, personnalisables. Un
      // changement de rôle sans permissions explicites réinitialise les accès
      // du nouveau rôle (une rétrogradation révoque donc bien les droits).
      if (mode === 'create') {
        payload.role = payload.role || 'membre';
        payload.permissions = normaliserPermissions(payload.role, payload.permissions);
      } else if (mode === 'update' && (payload.role || payload.permissions)) {
        const Membre = req.getModel('Membre', MembresSchema);
        const actuel = await Membre.findById(req.params.id).lean();
        const role = payload.role || actuel?.role || 'membre';
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
