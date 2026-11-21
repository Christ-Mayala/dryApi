const express = require('express');
const { buildCrudHandlers } = require('../../../../../dry/core/factories/crudFactory');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const { validateNova } = require('../../../validation/middleware');
const {
  forcerFiltre,
  forcerProprietaire,
  verifierPayloadAcces,
  exigerAccesRessource,
} = require('../../../services/acl.service');
const IaSchema = require('../model/ia.schema');

const handlers = buildCrudHandlers('RequeteIA', IaSchema, {
  transformInput: async ({ req, payload }) => {
    if (req.user?._id) {
      payload.createdBy = payload.createdBy || req.user._id;
      payload.updatedBy = req.user._id;
      payload.utilisateurId = req.user._id;
    }
    return payload;
  },
});

// L'historique IA est personnel : un administrateur NOVA ne lit pas les
// conversations privées des autres comptes.
const filtrerHistorique = (req, res, next) => {
  forcerFiltre(req, { utilisateurId: req.user._id });
  next();
};

const accesRequete = {
  modelName: 'RequeteIA',
  schema: IaSchema,
  proprieteProprietaire: 'utilisateurId',
};

const router = express.Router();

router.get('/', protect, filtrerHistorique, handlers.getMany);
router.get('/:id', protect, validateId, exigerAccesRessource(accesRequete), handlers.getOne);
router.post(
  '/',
  protect,
  forcerProprietaire('utilisateurId'),
  verifierPayloadAcces(),
  validateNova.ia.create,
  handlers.createOne
);
router.put(
  '/:id',
  protect,
  validateId,
  exigerAccesRessource({ ...accesRequete, droit: 'edition' }),
  forcerProprietaire('utilisateurId'),
  verifierPayloadAcces(),
  validateNova.ia.update,
  handlers.updateOne
);
router.delete(
  '/:id',
  protect,
  validateId,
  exigerAccesRessource({ ...accesRequete, droit: 'edition' }),
  handlers.deleteOne
);

module.exports = router;
