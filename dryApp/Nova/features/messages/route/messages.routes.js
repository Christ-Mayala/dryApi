const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const MessagesSchema = require('../model/messages.schema');
const {
  roomEquipe,
  emettre,
  notifierActiviteEquipe,
} = require('../../../services/tempsReel.service');

/**
 * Messagerie temps réel d'un espace d'équipe.
 *
 * La liste est filtrée par `?espaceId=<id>` (géré par le queryBuilder du noyau).
 * À la création d'un message, on diffuse l'événement `message:nouveau` dans la
 * room de l'espace puis on notifie les autres membres.
 */
module.exports = buildCrudRouter('Message', MessagesSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.messages.create,
    update: validateNova.messages.update,
  },
  crudOptions: {
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.auteurId = payload.auteurId || req.user._id;
        payload.createdBy = payload.createdBy || req.user._id;
        payload.updatedBy = req.user._id;
        if (!payload.auteurNom) payload.auteurNom = req.user.nom || req.user.name;
        if (!payload.auteurAvatar) payload.auteurAvatar = req.user.avatarUrl || req.user.avatar;
      }
      return payload;
    },
    afterCreate: async ({ req, doc }) => {
      const message = doc.toObject ? doc.toObject() : doc;
      if (message.espaceId) {
        // Diffusion immédiate aux clients connectés de l'espace.
        emettre(req, roomEquipe(message.espaceId), 'message:nouveau', message);

        // Notification persistée pour les autres membres de l'équipe.
        await notifierActiviteEquipe({
          req,
          espaceId: message.espaceId,
          type: 'systeme',
          titre: `${message.auteurNom || 'Un membre'} a envoyé un message`,
          message: String(message.contenu || '').slice(0, 200),
          pageId: message.pageId || undefined,
          exclureUserId: req.user?._id,
        });
      }
    },
  },
});
