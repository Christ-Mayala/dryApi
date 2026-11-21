const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const sendResponse = require('../../../../../dry/utils/http/response');
const { validateNova } = require('../../../validation/middleware');
const {
  exigerAdministrationNova,
  filtrerEspacesMiddleware,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const ConnexionsSchema = require('../model/connexions.schema');
const { testerConnexion } = require('../services/connexions.service');

const accesConnexion = {
  modelName: 'Connexion',
  schema: ConnexionsSchema,
};

// Les connexions contiennent des secrets : lecture et écriture réservées aux
// administrateurs NOVA, avec filtrage par espace pour les non-globaux.
const router = buildCrudRouter('Connexion', ConnexionsSchema, {
  auth: { list: 'user', get: 'user', create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.connexions.create,
    update: validateNova.connexions.update,
  },
  middlewares: {
    list: [exigerAdministrationNova, filtrerEspacesMiddleware('espaceId')],
    get: [exigerAdministrationNova, exigerAccesRessource(accesConnexion)],
    create: [exigerAdministrationNova, verifierPayloadAcces()],
    update: [
      exigerAdministrationNova,
      exigerAccesRessource({ ...accesConnexion, droit: 'edition' }),
      verifierPayloadAcces(),
    ],
    delete: [
      exigerAdministrationNova,
      exigerAccesRessource({ ...accesConnexion, droit: 'edition' }),
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

// Test d'une connexion : aucun appel réseau arbitraire n'est autorisé (voir
// `estUrlWebhookAutorisee` dans le service).
router.post(
  '/:id/tester',
  validateId,
  protect,
  exigerAdministrationNova,
  exigerAccesRessource({ ...accesConnexion, droit: 'edition' }),
  async (req, res, next) => {
    try {
      const connexion = req.novaRessource;
      const resultat = await testerConnexion(connexion);
      return sendResponse(res, resultat, resultat.message, true);
    } catch (erreur) {
      return next(erreur);
    }
  }
);

module.exports = router;
