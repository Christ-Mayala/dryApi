const express = require('express');
const { buildCrudHandlers } = require('./crudFactory');
const { protect, authorize } = require('../../middlewares/protection/auth.middleware');
const { validateId } = require('../../middlewares/validation/validation.middleware');
const { cache, invalidateCache } = require('../../middlewares/cache/cache.middleware');
const { withAudit } = require('../../middlewares/audit');

/**
 * Fabrique de routeurs Express pour une fonctionnalité DRY.
 * Automatise la création des routes CRUD standards avec leurs middlewares.
 * 
 * @param {string} modelName - Nom du modèle (ex: 'Product').
 * @param {Object} schema - Schéma Mongoose.
 * @param {Object} [config={}] - Configuration des routes.
 * @returns {import('express').Router} Routeur Express configuré.
 */
function buildCrudRouter(modelName, schema, config = {}) {
  const router = express.Router();
  const {
    // Options passées au crudFactory
    crudOptions = {},
    // Configuration de la sécurité par défaut
    auth = {
      all: false, // Si true, tout est protégé
      create: 'admin',
      update: 'admin',
      delete: 'admin'
    },
    // Configuration du cache
    caching = {
      list: 0, // Secs (0 = off)
      get: 0
    },
    // Middlewares d'upload
    upload = null,
    // Validations (Joi)
    validation = {
      create: null,
      update: null
    },
    // Audit (si activé)
    audit = true
  } = config;

  const handlers = buildCrudHandlers(modelName, schema, crudOptions);

  // Helper pour appliquer l'authentification
  const applyAuth = (action) => {
    const role = auth[action] || (auth.all ? 'user' : null);
    if (!role) return (req, res, next) => next();
    return [protect, authorize(role === 'user' ? [] : [role])];
  };

  // --- ROUTES ---

  // GET / (Liste)
  const listStack = [];
  if (auth.list) listStack.push(...applyAuth('list'));
  if (caching.list) listStack.push(cache(caching.list));
  router.get('/', ...listStack, handlers.getMany);

  // GET /:id (Détail)
  const getStack = [validateId];
  if (auth.get) getStack.push(...applyAuth('get'));
  if (caching.get) getStack.push(cache(caching.get));
  router.get('/:id', ...getStack, handlers.getOne);

  // POST / (Création)
  const createStack = [...applyAuth('create')];
  if (upload) createStack.push(upload);
  if (validation.create) createStack.push(validation.create);
  if (audit) createStack.push(withAudit(`${modelName.toUpperCase()}_CREATE`));
  if (caching.list || caching.get) createStack.push(invalidateCache());
  router.post('/', ...createStack, handlers.createOne);

  // PUT /:id (Mise à jour)
  const updateStack = [validateId, ...applyAuth('update')];
  if (upload) updateStack.push(upload);
  if (validation.update) updateStack.push(validation.update);
  if (audit) updateStack.push(withAudit(`${modelName.toUpperCase()}_UPDATE`));
  if (caching.list || caching.get) updateStack.push(invalidateCache());
  router.put('/:id', ...updateStack, handlers.updateOne);

  // DELETE /:id (Suppression)
  const deleteStack = [validateId, ...applyAuth('delete')];
  if (audit) deleteStack.push(withAudit(`${modelName.toUpperCase()}_DELETE`));
  if (caching.list || caching.get) deleteStack.push(invalidateCache());
  router.delete('/:id', ...deleteStack, handlers.deleteOne);

  return router;
}

module.exports = { buildCrudRouter };
