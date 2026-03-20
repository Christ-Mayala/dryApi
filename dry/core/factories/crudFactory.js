const asyncHandler = require('express-async-handler');
const sendResponse = require('../../utils/http/response');
const queryBuilder = require('../../middlewares/query/queryBuilder');

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
    // transformOutput permet d'adapter le document avant envoi (ex: nettoyage, calculs)
    transformOutput,
    // populateFields permet de faire des populate automatiques
    populateFields = '',
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

    let doc = await Model.create(payload);
    
    if (transformOutput) {
      doc = await transformOutput({ req, doc });
    }

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
      const err = new Error(`${modelName} introuvable`);
      err.status = 404;
      throw err;
    }

    sendResponse(res, null, `${modelName} supprimé`, true);
  });

  /**
   * Liste les documents avec filtrage, tri et pagination.
   */
  const getMany = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);
    const qb = queryBuilder(Model, populateFields);
    await qb(req, res, async () => {
      let results = req.queryResults;
      if (transformOutput && results.data) {
        results.data = await Promise.all(results.data.map(doc => transformOutput({ req, doc })));
      }
      sendResponse(res, results, `Liste des ${modelName} récupérée`, true);
    });
  });

  /**
   * Récupère un seul document par son ID.
   */
  const getOne = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);
    let query = Model.findById(req.params.id);
    if (populateFields) query = query.populate(populateFields);
    
    let doc = await query;
    if (!doc) {
      const err = new Error(`${modelName} introuvable`);
      err.status = 404;
      throw err;
    }

    if (transformOutput) {
      doc = await transformOutput({ req, doc });
    }

    sendResponse(res, doc, `${modelName} récupéré`, true);
  });

  return { createOne, updateOne, deleteOne, getMany, getOne };
}

module.exports = { buildCrudHandlers };
