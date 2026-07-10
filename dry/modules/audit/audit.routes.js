/**
 * Routes Audit — Consultation de la piste d'audit (réservé aux admins)
 * Monté automatiquement sur /api/v1/audit (voir dry/bootstrap/routes.js)
 * @module dry/modules/audit/audit.routes
 */
const express = require('express');
const { protect, authorize } = require('../../middlewares/protection/auth.middleware');
const sendResponse = require('../../utils/http/response');
const { getPagination } = require('../../utils/data/pagination');
const AuditLogSchema = require('../../models/audit/AuditLog.schema');
const getModel = require('../../core/factories/modelFactory');

const router = express.Router();

const getAuditLogModel = (req) => {
  if (typeof req.getModel === 'function') return req.getModel('AuditLog', AuditLogSchema);
  return getModel(req.appName || 'Trivida', 'AuditLog', AuditLogSchema);
};

/**
 * GET /api/v1/audit/logs
 * Liste paginée des logs d'audit, filtrable par utilisateur/action/type de ressource/statut.
 * Réservé aux admins.
 */
router.get('/logs', protect, authorize('admin'), async (req, res) => {
  try {
    const AuditLog = getAuditLogModel(req);
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20, maxLimit: 200 });

    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resourceType) filter.resourceType = req.query.resourceType;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    sendResponse(res, logs, 'Logs d\'audit récupérés', true, {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    sendResponse(res, null, 'Erreur lors de la récupération des logs d\'audit', false, undefined, 500);
  }
});

/**
 * GET /api/v1/audit/logs/:id
 * Détail d'un log d'audit précis.
 */
router.get('/logs/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const AuditLog = getAuditLogModel(req);
    const log = await AuditLog.findById(req.params.id);
    if (!log) return sendResponse(res, null, 'Log introuvable', false, undefined, 404);
    sendResponse(res, log, 'Log récupéré');
  } catch (error) {
    sendResponse(res, null, 'Erreur lors de la récupération du log', false, undefined, 500);
  }
});

module.exports = router;
