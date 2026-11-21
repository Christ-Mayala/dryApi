const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { validateNova } = require('../../../validation/middleware');
const {
  filtrerParProprietaire,
  forcerProprietaire,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const FavorisSchema = require('../model/favoris.schema');

const proprietaireStrict = {
  modelName: 'Favori',
  schema: FavorisSchema,
  proprieteProprietaire: 'utilisateurId',
};

// Les favoris sont strictement personnels : même un administrateur ne peut
// pas consulter ou modifier ceux d'un autre compte.
module.exports = buildCrudRouter('Favori', FavorisSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.favoris.create,
    update: validateNova.favoris.update,
  },
  middlewares: {
    list: [filtrerParProprietaire('utilisateurId')],
    get: [exigerAccesRessource(proprietaireStrict)],
    create: [forcerProprietaire('utilisateurId')],
    update: [
      exigerAccesRessource({ ...proprietaireStrict, droit: 'edition' }),
      forcerProprietaire('utilisateurId'),
    ],
    delete: [exigerAccesRessource({ ...proprietaireStrict, droit: 'edition' })],
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
