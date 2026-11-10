const { buildCrudRouter } = require('../../../../../dry/core/factories/routerFactory');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const sendResponse = require('../../../../../dry/utils/http/response');
const { validateNova } = require('../../../validation/middleware');
const { exigerAdministrationNova } = require('../../../services/acl.service');
const ConnexionsSchema = require('../model/connexions.schema');
const { testerConnexion } = require('../services/connexions.service');

// Fabrique CRUD du noyau DRY : GET /, GET /:id, POST /, PUT /:id, DELETE /:id.
// Lecture publique ; ecriture reservee au proprietaire ou a un administrateur.
const router = buildCrudRouter('Connexion', ConnexionsSchema, {
  auth: { create: 'user', update: 'user', delete: 'user' },
  caching: { list: 0, get: 0 },
  validation: {
    create: validateNova.connexions.create,
    update: validateNova.connexions.update,
  },
  middlewares: {
    create: [exigerAdministrationNova],
    update: [exigerAdministrationNova],
    delete: [exigerAdministrationNova],
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

// Test d'une connexion : effectue un appel externe reel selon le type.
// Repond toujours en succes applicatif ; `data.ok` indique le resultat du test.
router.post('/:id/tester', protect, exigerAdministrationNova, async (req, res, next) => {
  try {
    const Model = req.getModel('Connexion', ConnexionsSchema);
    const connexion = await Model.findById(req.params.id);
    if (!connexion) {
      return sendResponse(res, null, 'Connexion introuvable', false, undefined, 404);
    }
    const resultat = await testerConnexion(connexion);
    return sendResponse(res, resultat, resultat.message, true);
  } catch (erreur) {
    return next(erreur);
  }
});

module.exports = router;

