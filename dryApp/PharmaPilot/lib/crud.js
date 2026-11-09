const express = require('express');
const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../dry/utils/http/response');
const queryBuilder = require('../../../dry/middlewares/query/queryBuilder');
const { protect } = require('../../../dry/middlewares/protection/auth.middleware');
const { withAudit } = require('../../../dry/middlewares/audit');
const { invalidateCache } = require('../../../dry/middlewares/cache/cache.middleware');
const { validateId } = require('../../../dry/utils/validation/validation.util');
const { resolveTenant, requireRole, tenantFilter, applyTenantQuery } = require('./tenant');
const { requirePermission } = require('./permissions');
const { notFound } = require('./errors');

/**
 * Fabrique de routeur CRUD PharmaPilot — tenant-aware.
 *
 * Apporte ce que le `buildCrudRouter` du kernel ne couvre pas :
 *  - injection systematique du `tenantId` (cloisonnement des pharmacies) ;
 *  - soft delete (`status = deleted`) plutot qu'une suppression physique ;
 *  - `resolveTenant` + `requireRole` (hierarchie de roles pharmacie) ;
 *  - hooks de transformation de payload specifiques a l'entite.
 *
 * @param {object} config
 * @param {string} config.modelName
 * @param {object} config.schema
 * @param {string} config.entity            - libelle humain (ex: 'Produit')
 * @param {string} [config.auditPrefix]     - prefixe des actions d'audit
 * @param {Array}  [config.populate]        - populate applique a la liste et au detail
 * @param {string} [config.writeRoles]      - role minimum pour creer/modifier
 * @param {string} [config.deleteRoles]     - role minimum pour supprimer
 * @param {object} [config.permissions]     - permissions granulaires
 *   `{ read, write, remove }` : prioritaires sur les roles (controle backend)
 * @param {Function} [config.createValidation]
 * @param {Function} [config.updateValidation]
 * @param {Function} [config.preparePayload] - async (req, payload, mode) => payload
 * @param {Function} [config.afterRead]      - async (req, doc) => doc
 */
const buildCrudRouter = (config) => {
  const {
    modelName,
    schema,
    entity,
    auditPrefix = modelName.toUpperCase(),
    populate = null,
    writeRoles = 'stock_manager',
    deleteRoles = 'pharmacist',
    permissions = null,
    createValidation = null,
    updateValidation = null,
    preparePayload = null,
    afterRead = null,
  } = config;

  // Garde d'autorisation : permission granulaire si declaree, sinon niveau de role.
  const guard = (permission, role) =>
    permission ? requirePermission(permission) : requireRole(role);

  const router = express.Router();
  const getModel = (req) => req.getModel(modelName, schema);

  /** LISTE — paginee, filtree et cloisonnee par pharmacie. */
  const getAll = asyncHandler(async (req, res) => {
    const { data, pagination } = res.advancedResults || { data: [], pagination: null };
    const list = afterRead ? await Promise.all((data || []).map((d) => afterRead(req, d))) : data;
    return sendResponse(res, list, `Liste des ${entity} recuperee`, true, pagination || undefined);
  });

  /** DETAIL. */
  const getOne = asyncHandler(async (req, res) => {
    let query = getModel(req).findOne(tenantFilter(req, { _id: req.params.id }));
    if (populate) query = query.populate(populate);
    let doc = await query;
    if (!doc) throw notFound(`${entity} introuvable`);
    if (afterRead) doc = await afterRead(req, doc);
    return sendResponse(res, doc, `${entity} recupere`);
  });

  /** CREATE. */
  const create = asyncHandler(async (req, res) => {
    const Model = getModel(req);
    let payload = { ...req.body };
    if (preparePayload) payload = await preparePayload(req, payload, 'create');
    // Cloisonnement : `pharmacyId` (etablissement) porte la separation des
    // donnees metier, `tenantId` (organisation) le rattachement commercial.
    payload.pharmacyId = req.pharmacyId || payload.pharmacyId;
    payload.tenantId = req.tenantId || payload.tenantId;
    if (!payload.pharmacyId) throw notFound('Aucune pharmacie active pour cette operation');
    payload.createdBy = req.user?._id;
    payload.updatedBy = req.user?._id;

    const doc = await Model.create(payload);
    return sendResponse(res, doc, `${entity} cree`, true, undefined, 201);
  });

  /** UPDATE. */
  const update = asyncHandler(async (req, res) => {
    const doc = await getModel(req).findOne(tenantFilter(req, { _id: req.params.id }));
    if (!doc) throw notFound(`${entity} introuvable`);

    let payload = { ...req.body };
    if (preparePayload) payload = await preparePayload(req, payload, 'update');

    Object.keys(payload).forEach((key) => {
      if (['_id', 'tenantId', 'pharmacyId', 'createdBy', 'slug'].includes(key)) return;
      doc[key] = payload[key];
    });
    doc.updatedBy = req.user?._id;
    await doc.save();
    return sendResponse(res, doc, `${entity} mis a jour`);
  });

  /** DELETE — soft delete. */
  const remove = asyncHandler(async (req, res) => {
    const doc = await getModel(req).findOne(tenantFilter(req, { _id: req.params.id }));
    if (!doc) throw notFound(`${entity} introuvable`);
    doc.status = 'deleted';
    doc.updatedBy = req.user?._id;
    await doc.save();
    return sendResponse(res, null, `${entity} archive`);
  });

  const reads = [protect, resolveTenant, guard(permissions?.read, config.readRoles || 'preparer')];
  const writes = [protect, resolveTenant, guard(permissions?.write, writeRoles)];

  router.get(
    '/',
    ...reads,
    applyTenantQuery,
    queryBuilder((req) => req.getModel(modelName, schema), populate),
    getAll
  );

  router.post(
    '/',
    ...writes,
    ...(createValidation ? [createValidation] : []),
    withAudit(`${auditPrefix}_CREATE`),
    invalidateCache(),
    create
  );

  router.get('/:id', ...reads, validateId, getOne);

  router.put(
    '/:id',
    ...writes,
    validateId,
    ...(updateValidation ? [updateValidation] : []),
    withAudit(`${auditPrefix}_UPDATE`),
    invalidateCache(),
    update
  );

  router.delete(
    '/:id',
    protect,
    resolveTenant,
    guard(permissions?.remove, deleteRoles),
    validateId,
    withAudit(`${auditPrefix}_DELETE`),
    invalidateCache(),
    remove
  );

  return router;
};

module.exports = { buildCrudRouter };
