const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const AlertsSchema = require('../model/alerts.schema');
const { refreshAlerts } = require('../service/alerts.service');
const { notFound, badRequest } = require('../../../lib/errors');
const { tenantFilter } = require('../../../lib/tenant');

const POPULATE = [
  { path: 'productId', select: 'name sku unit form' },
  { path: 'lotId', select: 'lotNumber expiryDate' },
];

/** LISTE paginee et filtrable des alertes. */
exports.getAll = asyncHandler(async (req, res) => {
  const { data, pagination } = res.advancedResults || { data: [], pagination: null };
  return sendResponse(res, data, 'Liste des alertes', true, pagination || undefined);
});

/** DETAIL d'une alerte. */
exports.getOne = asyncHandler(async (req, res) => {
  const Alert = req.getModel('Alert', AlertsSchema);
  const doc = await Alert.findOne(tenantFilter(req, { _id: req.params.id })).populate(POPULATE);
  if (!doc) throw notFound('Alerte introuvable');
  return sendResponse(res, doc, 'Alerte recuperee');
});

/** REFRESH — recalcule les alertes a partir des soldes et des lots. */
exports.refresh = asyncHandler(async (req, res) => {
  const summary = await refreshAlerts(req);
  return sendResponse(res, summary, 'Alertes recalculees');
});

/** UPDATE — prise en charge manuelle (statut / note). */
exports.update = asyncHandler(async (req, res) => {
  const Alert = req.getModel('Alert', AlertsSchema);
  const alert = await Alert.findOne(tenantFilter(req, { _id: req.params.id }));
  if (!alert) throw notFound('Alerte introuvable');

  const { status, note } = req.body;
  if (status && !['open', 'acknowledged', 'resolved', 'ignored'].includes(status)) {
    throw badRequest('Statut d\'alerte invalide');
  }

  if (note !== undefined) alert.note = note;
  if (status) {
    alert.status = status;
    if (status === 'acknowledged') alert.acknowledgedBy = req.user._id;
    if (status === 'resolved' || status === 'ignored') {
      alert.resolvedBy = req.user._id;
      alert.resolvedAt = new Date();
    }
  }
  alert.updatedBy = req.user._id;
  await alert.save();
  return sendResponse(res, alert, 'Alerte mise a jour');
});
