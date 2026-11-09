const express = require('express');
const asyncHandler = require('express-async-handler');
const { buildCrudHandlers } = require('../../../../../dry/core/factories/crudFactory');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');
const { validateId } = require('../../../../../dry/middlewares/validation/validation.middleware');
const sendResponse = require('../../../../../dry/utils/http/response');
const { validateNova } = require('../../../validation/middleware');
const IaSchema = require('../model/ia.schema');

/** Un administrateur NOVA voit tout l'historique IA ; un membre voit le sien. */
function estAdminNova(utilisateur) {
  return (
    utilisateur?.role === 'admin' ||
    utilisateur?.role === 'superadmin' ||
    utilisateur?.novaPermissions?.admin === true
  );
}

const handlers = buildCrudHandlers('RequeteIA', IaSchema, {
  transformInput: async ({ req, payload }) => {
    if (req.user?._id) {
      payload.createdBy = payload.createdBy || req.user._id;
      payload.updatedBy = req.user._id;
      // La propriete de la requete est toujours celle du compte connecte :
      // un client ne peut ni la forger ni consulter celle d'un autre membre.
      payload.utilisateurId = req.user._id;
    }
    return payload;
  },
});

/** Force le filtre `utilisateurId` pour les non-administrateurs. */
const filtrerListe = (req, res, next) => {
  if (!estAdminNova(req.user)) {
    // `req.query` est un accesseur en lecture seule (Express 5) : une simple
    // affectation est silencieusement ignoree. On definit donc une propriete
    // propre sur la requete pour imposer le filtre de proprietaire.
    Object.defineProperty(req, 'query', {
      value: { ...req.query, utilisateurId: String(req.user._id) },
      writable: true,
      configurable: true,
    });
  }
  next();
};

/** Interdit l'acces a la requete IA d'un autre membre. */
const verifierProprietaire = asyncHandler(async (req, res, next) => {
  if (estAdminNova(req.user)) return next();
  const Model = req.getModel('RequeteIA', IaSchema);
  const doc = await Model.findById(req.params.id).select('utilisateurId').lean();
  if (!doc) return next();
  if (String(doc.utilisateurId || '') !== String(req.user._id)) {
    return sendResponse(res, null, 'Acces refuse', false, undefined, 403);
  }
  return next();
});

const router = express.Router();

router.get('/', protect, filtrerListe, handlers.getMany);
router.get('/:id', protect, validateId, verifierProprietaire, handlers.getOne);
router.post('/', protect, validateNova.ia.create, handlers.createOne);
router.put('/:id', protect, validateId, validateNova.ia.update, verifierProprietaire, handlers.updateOne);
router.delete('/:id', protect, validateId, verifierProprietaire, handlers.deleteOne);

module.exports = router;
