const asyncHandler = require('express-async-handler');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const sendResponse = require('../../../../../dry/utils/http/response');
const HousePreachingSourceSchema = require('../model/housePreachingSource.schema');
const { resolveChannelId, getUploadsPlaylistId } = require('../../../services/housePreachingSync.service');

/** Extrait le handle YouTube d'une URL (@ICCTV, youtube.com/@ICCTV, …). */
function extractHandle(input = '') {
  const s = String(input).trim();
  const m = s.match(/youtube\.com\/\/?@([A-Za-z0-9_.\-ç%]+)/i);
  if (m) return '@' + m[1];
  if (/^@[A-Za-z0-9_.\-ç%]+$/.test(s)) return s;
  return null;
}

/**
 * POST /housePreaching/sources/add — admin. Ajoute la chaîne d'un pasteur
 * (URL complète ou @handle), résout le channelId via l'API YouTube, crée la
 * source puis lance une synchronisation immédiate pour importer TOUTES ses
 * prédications.
 *
 * Body : { name, preacher, channelUrl?, channelHandle?, channelId?, category?, autoPublish? }
 */
async function addChannel(req, res) {
  const HousePreachingSource = req.getModel('HousePreachingSource', HousePreachingSourceSchema);
  const {
    name,
    preacher,
    channelUrl,
    channelHandle,
    channelId,
    category = 'predication',
    autoPublish = true,
  } = req.body || {};

  const handle = extractHandle(channelUrl || channelHandle || '');
  if (!name || !String(name).trim()) throw httpError('Le nom de la source est requis', 400);
  if (!channelId && !handle) throw httpError('Fournis une URL de chaîne YouTube ou un @handle', 400);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw httpError('YOUTUBE_API_KEY manquante côté serveur', 500);

  // Résout le channelId si on n'a qu'un handle (validité réelle de la chaîne).
  let resolvedChannelId = channelId || null;
  if (!resolvedChannelId && handle) {
    try {
      resolvedChannelId = await resolveChannelId(apiKey, handle);
    } catch (err) {
      throw httpError(`Chaîne introuvable pour ${handle} — vérifie le lien. (${err.message})`, 400);
    }
  }

  // Vérifie qu'on n'ajoute pas deux fois la même chaîne.
  const dup = await HousePreachingSource.findOne({
    $or: [{ channelId: resolvedChannelId }, { channelHandle: handle || null }],
  });
  if (dup) throw httpError(`Cette chaîne existe déjà (${dup.name})`, 409);

  const source = await HousePreachingSource.create({
    name: String(name).trim(),
    platform: 'youtube',
    channelId: resolvedChannelId,
    channelHandle: handle || undefined,
    channelUrl: channelUrl || (handle ? `https://www.youtube.com/${handle}` : undefined),
    preacher: preacher && String(preacher).trim() ? String(preacher).trim() : 'Pasteur Yves Castanou',
    category,
    autoPublish,
    isActive: true,
    syncStatus: 'never',
  });

  // Sync immédiate (même pipeline que le cron, avec son verrou anti-concurrence).
  let sync = null;
  try {
    const { runHousePreachingSyncNow } = require('../../../services/housePreachingSync.scheduler');
    sync = await runHousePreachingSyncNow();
  } catch (err) {
    sync = { errors: 1, message: err.message };
  }

  return sendResponse(res, { source, sync }, 'Chaîne ajoutée et synchronisée');
}

/**
 * POST /housePreaching/sources/:id/resolve — admin. Résout handle/channelId
 * d'une source existante (utile quand une source a été créée avec un handle
 * et que la sync a échoué).
 */
async function resolveSource(req, res) {
  const HousePreachingSource = req.getModel('HousePreachingSource', HousePreachingSourceSchema);
  const item = await HousePreachingSource.findById(req.params.id);
  if (!item) throw httpError('Source introuvable', 404);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw httpError('YOUTUBE_API_KEY manquante côté serveur', 500);

  let channelId = item.channelId;
  const handle = extractHandle(item.channelUrl || item.channelHandle || '');
  if (!channelId && handle) {
    try {
      channelId = await resolveChannelId(apiKey, handle);
    } catch (err) {
      throw httpError(`Chaîne introuvable pour ${handle}`, 400);
    }
  }
  if (channelId) {
    item.channelId = channelId;
    if (handle) item.channelHandle = handle;
    await item.save();
  }

  return sendResponse(res, item, 'Source résolue');
}

async function listSources(req, res) {
  const HousePreachingSource = req.getModel('HousePreachingSource', HousePreachingSourceSchema);
  const items = await HousePreachingSource.find({}).sort({ createdAt: -1 });
  return sendResponse(res, items, 'Sources récupérées');
}

async function createSource(req, res) {
  const HousePreachingSource = req.getModel('HousePreachingSource', HousePreachingSourceSchema);
  const item = await HousePreachingSource.create(req.body);
  return sendResponse(res, item, 'Source créée');
}

async function updateSource(req, res) {
  const HousePreachingSource = req.getModel('HousePreachingSource', HousePreachingSourceSchema);
  const item = await HousePreachingSource.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) throw httpError('Source introuvable', 404);
  return sendResponse(res, item, 'Source mise à jour');
}

async function removeSource(req, res) {
  const HousePreachingSource = req.getModel('HousePreachingSource', HousePreachingSourceSchema);
  await HousePreachingSource.findByIdAndDelete(req.params.id);
  return sendResponse(res, null, 'Source supprimée');
}

async function toggleActive(req, res) {
  const HousePreachingSource = req.getModel('HousePreachingSource', HousePreachingSourceSchema);
  const item = await HousePreachingSource.findById(req.params.id);
  if (!item) throw httpError('Source introuvable', 404);
  item.isActive = !item.isActive;
  await item.save();
  return sendResponse(res, item, 'Source activée/désactivée');
}

module.exports = { listSources, createSource, updateSource, removeSource, toggleActive, addChannel, resolveSource };
