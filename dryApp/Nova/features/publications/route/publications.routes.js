const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const { exigerPartageNova } = require('../../../services/acl.service');
const PublicationsSchema = require('../model/publications.schema');
const { notifierNouvellesInvitations } = require('../services/invitations.service');

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture publique ; ecriture reservee au proprietaire ou a un administrateur.
module.exports = buildCrudRouter('Publication', PublicationsSchema, {
  auth: { create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.publications.create,
    update: validateNova.publications.update,
  },
  middlewares: {
    create: [exigerPartageNova],
    update: [exigerPartageNova],
    delete: [exigerPartageNova],
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
    // Invitations : notifie par email les personnes nouvellement invitées.
    afterCreate: async ({ req, doc }) => {
      if (doc?.invites?.length) await notifierNouvellesInvitations({ req, publication: doc });
    },
    afterUpdate: async ({ req, doc, previous }) => {
      if (!doc?.invites?.length) return;
      const precedents = (previous?.invites || []).map((i) => i.email);
      await notifierNouvellesInvitations({ req, publication: doc, emailsPrecedents: precedents });
    },
  },
});
