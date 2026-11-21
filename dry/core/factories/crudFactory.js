const asyncHandler = require('express-async-handler');
const sendResponse = require('../../utils/http/response');
const queryBuilder = require('../../middlewares/query/queryBuilder');
const logger = require('../../utils/logging/logger');

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
 * @property {string[]} [allowedFields] - Liste des champs autorisés pour la création/mise à jour.
 * @property {function({req: Request, doc: Object, payload: Object}): Promise<void>} [afterCreate] - Effet de bord après création (ex: envoi d'email). Non bloquant.
 * @property {function({req: Request, doc: Object, previous: Object, payload: Object}): Promise<void>} [afterUpdate] - Effet de bord après mise à jour.
 * @property {function({req: Request, doc: Object, suppressionDéfinitive: boolean}): Promise<void>} [afterDelete] - Effet de bord après suppression.
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
/**
 * Exécute un effet de bord avec une reprise immédiate et une journalisation
 * structurée. L'effet n'est plus « fire-and-forget » : le client ne reçoit sa
 * réponse qu'après son exécution (ou après épuisement des tentatives). Une
 * panne est tracée avec le modèle, l'action et l'identifiant du document pour
 * permettre une reprise manuelle ou, en P6, via une file durable.
 */
async function executerEffet({ modelName, action, doc, effet, critique = false }) {
  const contexte = {
    evenement: 'nova.crud.effet',
    modele: modelName,
    action,
    documentId: String(doc?._id || ''),
  };
  let dernierErreur = null;
  for (let tentative = 1; tentative <= 2; tentative += 1) {
    try {
      await effet();
      logger(JSON.stringify({ ...contexte, statut: 'ok', tentative }), 'info');
      return;
    } catch (erreur) {
      dernierErreur = erreur;
      logger(
        JSON.stringify({
          ...contexte,
          statut: tentative === 2 ? 'echec' : 'reessai',
          tentative,
          erreur: erreur?.message || String(erreur),
        }),
        'error'
      );
    }
  }
  // Un effet critique (ex. : création de l'appartenance propriétaire d'un
  // workspace) ne peut pas être journalisé puis ignoré : le client recevrait
  // un succès pour un workspace inutilisable.
  if (critique && dernierErreur) throw dernierErreur;
}

function buildCrudHandlers(modelName, schema, options = {}) {
  const {
    // transformInput permet d'adapter la payload (ex: ajout des URLs Cloudinary)
    transformInput,
    // transformOutput permet d'adapter le document avant envoi (ex: nettoyage, calculs)
    transformOutput,
    // populateFields permet de faire des populate automatiques
    populateFields = '',
    // afterCreate / afterUpdate / afterDelete : effets structurés (ex: envoi
    // d'email, synchronisation des accès). Ils sont await et journalisés.
    afterCreate,
    afterUpdate,
    afterDelete,
    effetsCritiques = [],
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

    if (afterCreate) {
      await executerEffet({
        modelName,
        action: 'afterCreate',
        doc,
        effet: () => afterCreate({ req, doc, payload }),
        critique: effetsCritiques.includes('afterCreate'),
      });
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

    const previous = afterUpdate ? await Model.findById(req.params.id).lean() : null;

    // `?includeDeleted=true` permet d'atteindre un document supprimé (soft
    // delete) par son identifiant : restauration depuis la corbeille. Le
    // marqueur est transmis en option pour que le plugin DRY n'ajoute pas son
    // filtre `status: { $ne: 'deleted' }`.
    const options = { returnDocument: 'after', runValidators: true };
    if (req.query?.includeDeleted === 'true') options.includeDeleted = true;

    const doc = await Model.findByIdAndUpdate(req.params.id, payload, options);

    if (!doc) {
      throw new Error(`${modelName} introuvable`);
    }

    if (afterUpdate) {
      await executerEffet({
        modelName,
        action: 'afterUpdate',
        doc,
        effet: () => afterUpdate({ req, doc, previous, payload }),
      });
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
    const suppressionDéfinitive =
      req.allowPermanentDelete === true && req.query?.includeDeleted === 'true';
    const prendEnChargeSoftDelete = Boolean(schema?.path?.('status'));

    let doc;
    if (suppressionDéfinitive || !prendEnChargeSoftDelete) {
      // Purge définitive : uniquement si la route a explicitement autorisé
      // cette opération (middleware ACL dédié) et ciblé un document déjà en
      // corbeille. Aucun appel client ne peut la déclencher par défaut.
      const options = req.query?.includeDeleted === 'true' ? { includeDeleted: true } : {};
      doc = await Model.findByIdAndDelete(req.params.id, options);
    } else {
      // Suppression logique par défaut : le document reste en corbeille et
      // reste restaurable. Le plugin DRY masque ensuite `status: 'deleted'`.
      const maj = {
        $set: {
          status: 'deleted',
          deletedAt: new Date(),
          ...(req.user?._id ? { updatedBy: req.user._id } : {}),
        },
      };
      doc = await Model.findOneAndUpdate({ _id: req.params.id, status: { $ne: 'deleted' } }, maj, {
        new: true,
        includeDeleted: false,
      });
    }

    if (!doc) {
      const err = new Error(`${modelName} introuvable`);
      err.status = 404;
      throw err;
    }

    if (afterDelete) {
      await executerEffet({
        modelName,
        action: 'afterDelete',
        doc,
        effet: () => afterDelete({ req, doc, suppressionDéfinitive }),
      });
    }

    logger(`[crudFactory] ${modelName} ${suppressionDéfinitive ? 'purgé' : 'archivé'}`, 'info');
    sendResponse(res, null, `${modelName} ${suppressionDéfinitive ? 'purgé' : 'supprimé'}`, true);
  });

  /**
   * Liste les documents avec filtrage, tri et pagination.
   */
  const getMany = asyncHandler(async (req, res) => {
    const Model = req.getModel(modelName, schema);
    const qb = queryBuilder(Model, populateFields);
    await qb(req, res, async () => {
      // queryBuilder attache son resultat sur res.advancedResults (pas req.queryResults).
      const { data, pagination } = res.advancedResults || { data: [], pagination: undefined };
      let list = data;
      if (transformOutput && list) {
        list = await Promise.all(list.map((doc) => transformOutput({ req, doc })));
      }
      sendResponse(res, list, `Liste des ${modelName} récupérée`, true, pagination);
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

/**
 * Fabrique de contrôleurs CRUD pour les tests (ancienne interface).
 * @param {Model} Model - Le modèle Mongoose.
 * @param {CrudOptions} [options={}] - Options.
 * @returns {{
 *   create: function(Request, Response, NextFunction): Promise<void>,
 *   getAll: function(Request, Response, NextFunction): Promise<void>,
 *   getById: function(Request, Response, NextFunction): Promise<void>,
 *   update: function(Request, Response, NextFunction): Promise<void>,
 *   delete: function(Request, Response, NextFunction): Promise<void>
 * }}
 */
function crudFactory(Model, options = {}) {
  const { allowedFields = [] } = options;

  const filterFields = (data) => {
    if (allowedFields.length === 0) return data;
    const filtered = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    }
    return filtered;
  };

  const create = asyncHandler(async (req, res) => {
    const payload = filterFields(req.body);
    const doc = await Model.create(payload);
    sendResponse(res, doc, 'Créé avec succès', true, undefined, 201);
  });

  const getAll = asyncHandler(async (req, res) => {
    const docs = await Model.find();
    sendResponse(res, docs, 'Liste récupérée', true);
  });

  const getById = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) {
      return sendResponse(res, null, 'Document introuvable', false, undefined, 404);
    }
    sendResponse(res, doc, 'Document récupéré', true);
  });

  const update = asyncHandler(async (req, res) => {
    const payload = filterFields(req.body);
    const doc = await Model.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!doc) {
      return sendResponse(res, null, 'Document introuvable', false, undefined, 404);
    }
    sendResponse(res, doc, 'Mis à jour avec succès', true);
  });

  const deleteOne = asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) {
      return sendResponse(res, null, 'Document introuvable', false, undefined, 404);
    }
    sendResponse(res, null, 'Supprimé avec succès', true);
  });

  return { create, getAll, getById, update, delete: deleteOne };
}

module.exports = { buildCrudHandlers, crudFactory };
