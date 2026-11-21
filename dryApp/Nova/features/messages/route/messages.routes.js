const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerEditionNova,
  filtrerEspacesMiddleware,
  forcerProprietaire,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const MessagesSchema = require('../model/messages.schema');
const {
  roomEquipe,
  emettre,
  notifierActiviteEquipe,
} = require('../../../services/tempsReel.service');

const accesMessage = {
  modelName: 'Message',
  schema: MessagesSchema,
};

module.exports = buildCrudRouter('Message', MessagesSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.messages.create,
    update: validateNova.messages.update,
  },
  middlewares: {
    list: [filtrerEspacesMiddleware('espaceId')],
    get: [exigerAccesRessource(accesMessage)],
    create: [exigerEditionNova, forcerProprietaire('auteurId'), verifierPayloadAcces()],
    update: [
      exigerEditionNova,
      exigerAccesRessource({
        ...accesMessage,
        droit: 'edition',
        proprieteProprietaire: 'auteurId',
        autoriserAdminProprietaire: true,
      }),
      verifierPayloadAcces(),
    ],
    delete: [
      exigerEditionNova,
      exigerAccesRessource({
        ...accesMessage,
        droit: 'edition',
        proprieteProprietaire: 'auteurId',
        autoriserAdminProprietaire: true,
      }),
    ],
  },
  crudOptions: {
    transformInput: async ({ req, payload }) => {
      if (req.user?._id) {
        payload.auteurId = req.user._id;
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
        emettre(req, roomEquipe(message.espaceId), 'message:nouveau', message);
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
