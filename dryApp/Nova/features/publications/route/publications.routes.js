const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerPartageNova,
  filtrerParPages,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const PublicationsSchema = require('../model/publications.schema');
const { notifierNouvellesInvitations } = require('../services/invitations.service');

const accesPublication = {
  modelName: 'Publication',
  schema: PublicationsSchema,
};

module.exports = buildCrudRouter('Publication', PublicationsSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.publications.create,
    update: validateNova.publications.update,
  },
  middlewares: {
    list: [exigerPartageNova, filtrerParPages()],
    get: [exigerPartageNova, exigerAccesRessource(accesPublication)],
    create: [exigerPartageNova, verifierPayloadAcces()],
    update: [
      exigerPartageNova,
      exigerAccesRessource({ ...accesPublication, droit: 'edition' }),
      verifierPayloadAcces(),
    ],
    delete: [
      exigerPartageNova,
      exigerAccesRessource({ ...accesPublication, droit: 'edition' }),
    ],
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
