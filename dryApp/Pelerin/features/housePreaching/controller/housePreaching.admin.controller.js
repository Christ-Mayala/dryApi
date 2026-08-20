const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const HousePreachingSchema = require('../model/housePreaching.schema');

// GET /housePreaching/admin/all?status=&category=
const listAll = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const { status, category } = req.query;
  const query = {};
  if (status === 'published') query.isPublished = true;
  if (status === 'draft') query.isPublished = false;
  if (status === 'disabled') query.isActive = false;
  if (category) query.category = category;

  const items = await HousePreaching.find(query).sort({ publishedAt: -1 });
  return sendResponse(res, items, 'Prédications récupérées (admin)');
});

// POST /housePreaching/admin
const create = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const item = await HousePreaching.create(req.body);
  return sendResponse(res, item, 'Prédication créée');
});

// PUT /housePreaching/admin/:id
const update = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const item = await HousePreaching.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) throw httpError('Prédication introuvable', 404);
  return sendResponse(res, item, 'Prédication mise à jour');
});

// DELETE /housePreaching/admin/:id
const remove = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const item = await HousePreaching.findByIdAndDelete(req.params.id);
  if (!item) throw httpError('Prédication introuvable', 404);
  return sendResponse(res, null, 'Prédication supprimée');
});

// POST /housePreaching/admin/:id/publish
const togglePublish = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const item = await HousePreaching.findById(req.params.id);
  if (!item) throw httpError('Prédication introuvable', 404);
  item.isPublished = !item.isPublished;
  await item.save();
  return sendResponse(res, item, 'Publication basculée');
});

// POST /housePreaching/admin/:id/activate
const toggleActive = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const item = await HousePreaching.findById(req.params.id);
  if (!item) throw httpError('Prédication introuvable', 404);
  item.isActive = !item.isActive;
  await item.save();
  return sendResponse(res, item, 'Activation basculée');
});

// POST /housePreaching/admin/:id/sync
const syncYouTube = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const item = await HousePreaching.findById(req.params.id);
  if (!item) throw httpError('Prédication introuvable', 404);

  // Marquer le lastSyncedAt sur la prédication individuelle
  item.lastSyncedAt = new Date();
  item.syncStatus = 'ok';
  await item.save();

  return sendResponse(res, item, 'Synchronisation déclenchée pour cette prédication');
});

module.exports = { listAll, create, update, remove, togglePublish, toggleActive, syncYouTube };
