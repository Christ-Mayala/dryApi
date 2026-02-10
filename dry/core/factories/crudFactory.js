const asyncHandler = require('express-async-handler');
const sendResponse = require('../../utils/http/response');

/**
 * @typedef {import('mongoose').Model} Model
 * @typedef {import('mongoose').Schema} Schema
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

/**
 * Options pour la construction des handlers CRUD.
 * @typedef {Object} CrudOptions
 * @property {function({req: Request, mode: string, payload: Object}): Promise<Object>} [transformInput] - Fonction pour transformer les données entrantes avant création/mise à jour.
 */

/**
 * Fabrique de contrôleurs CRUD génériques pour un modèle Mongoose dynamique.
 * 
 * @param {string} modelName - Le nom du modèle (ex: 'Product').
 * @param {Object} schema - Le schéma Mongoose du modèle.
 * @param {Object} [options={}] - Options de configuration supplémentaires.
 * @param {Function} [options.transformInput] - Fonction async pour transformer le payload avant création/mise à jour. 
 *                                              Signature: `({ req, mode, payload }) => Promise<Object>`
 * @returns {{
 *   createOne: import('express').RequestHandler,
 *   updateOne: import('express').RequestHandler,
 *   deleteOne: import('express').RequestHandler
 * }} Objet contenant les handlers express (createOne, updateOne, deleteOne).
 * 
 * @example
 * const ProductSchema = require('../model/product.schema');
 * const { createOne, updateOne, deleteOne } = buildCrudHandlers('Product', ProductSchema);
 * router.post('/', protect, authorize('admin'), upload.array('images', 5), createOne);
 * ```
 *
 * @param {string} modelName - Le nom du modèle Mongoose (ex: 'User', 'Product').
 * @param {Schema} schema - Le schéma Mongoose associé.
 * @param {CrudOptions} [options={}] - Options de configuration.
 * @returns {{
 *   createOne: function(Request, Response, NextFunction): Promise<void>,
 *   updateOne: function(Request, Response, NextFunction): Promise<void>,
 *   deleteOne: function(Request, Response, NextFunction): Promise<void>
 * }} Un objet contenant les middlewares Express pour createOne, updateOne, deleteOne.
 */
function buildCrudHandlers(modelName, schema, options = {}) {
  const {
    // transformInput permet d'adapter la payload (ex: ajout des URLs Cloudinary)
    transformInput,
  } = options;

  /**
   * Crée un nouveau document.
   * @param {Request} req 
   * @param {Response} res 
   */
  const createOne = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);

    let payload = { ...req.body };
    if (transformInput) {
      payload = await transformInput({ req, mode: 'create', payload });
    }

    const doc = await Model.create(payload);
    sendResponse(res, doc, `${modelName} créé`, true);
  });

  /**
   * Met à jour un document existant par son ID.
   * @param {Request} req 
   * @param {Response} res 
   */
  const updateOne = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);

    let payload = { ...req.body };
    if (transformInput) {
      payload = await transformInput({ req, mode: 'update', payload });
    }

    const doc = await Model.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      throw new Error(`${modelName} introuvable`);
    }

    sendResponse(res, doc, `${modelName} mis à jour`, true);
  });

  /**
   * Supprime un document par son ID.
   * @param {Request} req 
   * @param {Response} res 
   */
  const deleteOne = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      throw new Error(`${modelName} introuvable`);
    }

    sendResponse(res, null, `${modelName} supprimé`, true);
  });

  return { createOne, updateOne, deleteOne };
}

module.exports = { buildCrudHandlers };
