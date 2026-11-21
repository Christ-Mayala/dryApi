const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  idsEspacesAutorises,
  forcerFiltre,
  exigerEditionNova,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const BasesSchema = require('../model/bases.schema');

/**
 * Restreint la liste des bases :
 * - Une base privee n'appartient qu'a son proprietaire (elle n'apparait ni dans
 *   le repertoire de l'equipe ni pour les autres membres) ;
 * - Pour un non-administrateur, les autres bases sont limitees aux espaces
 *   autorises (les bases qu'il a creees restent visibles).
 */
const filtrerListe = (req, res, next) => {
  const filtre = {
    $nor: [{ section: 'prive', createdBy: { $ne: req.user._id } }],
  };
  const ids = idsEspacesAutorises(req);
  if (ids !== null) {
    filtre.$or = [{ espaceId: { $in: ids } }, { createdBy: req.user._id }];
  }
  forcerFiltre(req, filtre);
  next();
};

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture reservee aux membres connectes (la liste est filtree par visibilite) ;
// ecriture reservee aux membres connectes.
module.exports = buildCrudRouter('Base', BasesSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.bases.create,
    update: validateNova.bases.update,
  },
  middlewares: {
    list: [filtrerListe],
    get: [exigerAccesRessource({ modelName: 'Base', schema: BasesSchema, sectionPrivee: true })],
    create: [exigerEditionNova, verifierPayloadAcces()],
    update: [
      exigerEditionNova,
      exigerAccesRessource({
        modelName: 'Base',
        schema: BasesSchema,
        droit: 'edition',
        sectionPrivee: true,
      }),
      verifierPayloadAcces(),
    ],
    delete: [
      exigerEditionNova,
      exigerAccesRessource({
        modelName: 'Base',
        schema: BasesSchema,
        droit: 'edition',
        sectionPrivee: true,
      }),
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
  },
});
