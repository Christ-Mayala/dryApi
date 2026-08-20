/**
 * Service de synchronisation YouTube pour les Prédications de la Maison.
 *
 * Utilise la YouTube Data API v3 pour :
 *   1. Résoudre le handle (@ICCTV, @icctvcongo) en channelId.
 *   2. Récupérer l'ID de la playlist « Uploads » de la chaîne.
 *   3. Lister les vidéos de cette playlist.
 *   4. Dédupliquer par youtubeVideoId.
 *   5. Créer / mettre à jour les documents HousePreaching.
 *
 * Variables d'environnement requises :
 *   - YOUTUBE_API_KEY : clé API YouTube Data API v3 (Google Cloud Console).
 *
 * Configuration des sources : voir model/housePreachingSource.schema.js
 */

const axios = require('axios');
const { categorizePreaching } = require('./housePreachingCategorization.service');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Prequeur deduit du handle de la chaîne quand la source n'en definit pas.
// Ordre du tableau = priorite de correspondance (prefixe du handle).
const PREACHER_BY_HANDLE = [
  { handle: '@icctvcongo', preacher: 'Pasteur Yvan Castanou' },
  { handle: '@icctv', preacher: 'Pasteur Yves Castanou' },
];

// Detection PAR TITRE : quand le titre nomme explicitement Yvan ou Yves
// Castanou, le prequeur suit le TITRE. C'est le correctif du melange
// Yves/Yvan : la chaîne ICCTV poste aussi des sermons d'Yvan (camps,
// conferences…), qui etaient attribues a Yves parce qu'on ne regardait que le
// canal. Le titre prime donc sur le canal, le canal reste le secours pour les
// titres qui ne nomment personne.
const PREACHER_BY_TITLE = [
  { names: ['yvan', 'ivan castanou'], preacher: 'Pasteur Yvan Castanou' },
  { names: ['yves'], preacher: 'Pasteur Yves Castanou' },
];

/**
 * Resout le prequeur depuis le titre seul, ou null si le titre ne nomme
 * aucun des deux pasteurs connus.
 */
function resolvePreacherFromTitle(title = '') {
  const t = String(title).toLowerCase();
  const match = PREACHER_BY_TITLE.find((p) => p.names.some((n) => t.includes(n)));
  return match ? match.preacher : null;
}

/**
 * Resout le prequeur d'une predication. Ordre de priorite :
 *   1. Le TITRE, s'il nomme explicitement Yves ou Yvan Castanou (un sermon
 *      d'Yvan publie sur la chaîne ICCTV reste un sermon d'Yvan).
 *   2. Le channelHandle de la source pour les chaînes connues (garantie que
 *      les deux chaînes ne sont jamais melangees).
 *   3. source.preacher, sinon defaut Yves Castanou.
 */
function resolvePreacher(source, title = '') {
  const fromTitle = resolvePreacherFromTitle(title);
  if (fromTitle) return fromTitle;
  const handle = (source.channelHandle || '').toLowerCase();
  const match = PREACHER_BY_HANDLE.find((p) => handle.startsWith(p.handle));
  if (match) return match.preacher;
  if (source.preacher && source.preacher.trim()) return source.preacher.trim();
  return 'Pasteur Yves Castanou';
}

/**
 * Resout la categorie d'une predication. La categorie explicite de la source
 * (choisie par l'admin, donc differente de la valeur par defaut 'predication')
 * prime ; sinon deduction automatique depuis le titre. Sans ce garde-fou,
 * toutes les sources seedees avec la valeur par defaut forceraient
 * 'predication' et la categorisation automatique ne servirait a rien.
 */
function resolveCategory(source, title) {
  if (source.category && String(source.category).trim() !== 'predication') {
    return String(source.category).trim();
  }
  return categorizePreaching(title);
}

/**
 * Récupère les sources YouTube actives depuis MongoDB.
 */
async function getActiveSources(HousePreachingSource) {
  return HousePreachingSource.find({ isActive: true, platform: 'youtube' }).lean();
}

/**
 * Résout un handle YouTube (@ICCTV) en channelId via l'API YouTube.
 */
async function resolveChannelId(apiKey, handle) {
  const { data } = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
    params: { part: 'id', forHandle: handle, key: apiKey },
    timeout: 15000,
  });
  if (!data.items || data.items.length === 0) {
    throw new Error(`Chaîne introuvable pour le handle ${handle}`);
  }
  return data.items[0].id;
}

/**
 * Récupère l'ID de la playlist « Uploads » d'une chaîne.
 */
async function getUploadsPlaylistId(apiKey, channelId) {
  const { data } = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
    params: { part: 'contentDetails', id: channelId, key: apiKey },
    timeout: 15000,
  });
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`Playlist d'uploads introuvable pour ${channelId}`);
  return uploads;
}

/**
 * Récupère les vidéos d'une playlist (max MAX_VIDEOS_PER_SOURCE items), avec
 * arrêt précoce : si TOUTE une page (50) est déjà connue en base, la playlist
 * étant triée de la plus récente à la plus ancienne, les pages suivantes sont
 * forcément connues aussi → on s'arrête (économie de quota, pas de re-scan
 * des milliers d'anciennes vidéos à chaque passe).
 *
 * @param {Set<string>} knownVideoIds - youtubeVideoId déjà présents en base.
 */
async function getAllPlaylistItems(apiKey, playlistId, knownVideoIds = new Set()) {
  const items = [];
  let pageToken = null;

  do {
    const params = {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      key: apiKey,
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
      params,
      timeout: 15000,
    });

    const page = data.items || [];
    items.push(...page);
    pageToken = data.nextPageToken || null;

    // Arrêt précoce : plus rien de nouveau sur cette page → stop.
    if (page.length > 0 && page.every((i) => knownVideoIds.has(i.contentDetails?.videoId))) {
      break;
    }

    // Arrête la pagination dès qu'on a assez de vidéos
    if (items.length >= MAX_VIDEOS_PER_SOURCE) break;
  } while (pageToken);

  return items.slice(0, MAX_VIDEOS_PER_SOURCE);
}

/**
 * Statut de diffusion d'une vidéo (live / upcoming / none) à partir de
 * liveStreamingDetails de l'API videos. Permet le filtre « En direct / Passé ».
 */
function resolveLiveStatus(liveDetails) {
  if (!liveDetails) return 'none';
  if (liveDetails.concurrentViewers) return 'live';
  if (liveDetails.actualStartTime) return 'none'; // diffusion terminée → passé
  if (liveDetails.scheduledStartTime) return 'upcoming';
  return 'none';
}

/**
 * Récupère les durées + le statut live des vidéos en batch (max 50 par appel).
 */
async function getVideoDurations(apiKey, videoIds) {
  const meta = {};
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    try {
      const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: { part: 'contentDetails,liveStreamingDetails', id: chunk.join(','), key: apiKey },
        timeout: 15000,
      });
      for (const v of data.items || []) {
        const iso = v.contentDetails?.duration;
        meta[v.id] = {
          duration: iso ? isoToDuration(iso) : null,
          live: resolveLiveStatus(v.liveStreamingDetails),
        };
      }
    } catch (_) {
      // ignore les erreurs par batch
    }
  }

  return meta;
}

/**
 * Convertit une durée ISO 8601 (PT1H2M3S) en format lisible "1:02:03".
 */
function isoToDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Synchronise toutes les sources YouTube actives.
 * Limite à MAX_VIDEOS_PER_SOURCE vidéos par source pour éviter les timeouts.
 */
const MAX_VIDEOS_PER_SOURCE = 100;

async function syncFromYouTube(HousePreaching, HousePreachingSource) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { synced: 0, created: 0, updated: 0, errors: 0, message: 'YOUTUBE_API_KEY manquant' };
  }

  const sources = await getActiveSources(HousePreachingSource);
  if (sources.length === 0) {
    return { synced: 0, created: 0, updated: 0, errors: 0, message: 'Aucune source active' };
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const source of sources) {
    try {
      // 1. Résoudre le handle en channelId si nécessaire
      let channelId = source.channelId;
      if (!channelId && source.channelHandle) {
        channelId = await resolveChannelId(apiKey, source.channelHandle);
      }
      if (!channelId) {
        totalErrors++;
        continue;
      }

      // 2. Récupérer la playlist d'uploads
      let playlistId = source.playlistId;
      if (!playlistId) {
        playlistId = await getUploadsPlaylistId(apiKey, channelId);
      }
      if (!playlistId) {
        totalErrors++;
        continue;
      }

      // 3. Récupérer les vidéos (limitées à MAX_VIDEOS_PER_SOURCE, arrêt
      //    précoce si toutes les vidéos de la page sont déjà connues)
      const knownDocs = await HousePreaching.find({ sourceId: source._id })
        .select('youtubeVideoId')
        .lean();
      const knownVideoIds = new Set(knownDocs.map((d) => d.youtubeVideoId));
      const items = await getAllPlaylistItems(apiKey, playlistId, knownVideoIds);
      if (items.length === 0) continue;

      // 4. Récupérer les durées en batch — UNIQUEMENT pour les vidéos nouvelles
      //    (les existantes conservent leur durée déjà stockée, pas de re-fetch).
      const videoIds = items.map((i) => i.contentDetails?.videoId).filter(Boolean);
      const newVideoIds = videoIds.filter((vid) => !knownVideoIds.has(vid));
      const videoMeta = newVideoIds.length > 0
        ? await getVideoDurations(apiKey, newVideoIds)
        : {};

      // 5. Dédupliquer et upsert
      const existing = await HousePreaching.find({ youtubeVideoId: { $in: videoIds } });
      const existingMap = new Map(existing.map((e) => [e.youtubeVideoId, e]));

      const ops = [];
      for (const item of items) {
        const vid = item.contentDetails?.videoId;
        if (!vid) continue;
        const snippet = item.snippet;
        const title = snippet?.title || 'Sans titre';
        const description = snippet?.description || '';
        const publishedAt = snippet?.publishedAt ? new Date(snippet.publishedAt) : new Date();
        const thumbnails = snippet?.thumbnails;
        const coverUrl = thumbnails?.maxres?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || null;
        const youtubeUrl = `https://www.youtube.com/watch?v=${vid}`;
        // Le titre prime sur le canal (Yves/Yvan) : c'est ce qui garantit que
        // les sermons d'Yvan postes sur ICCTV ne sont pas attribues a Yves.
        const preacher = resolvePreacher(source, title);
        const category = resolveCategory(source, title);

        const existingDoc = existingMap.get(vid);
        // Vidéo déjà connue → pas de re-fetch de durée, on conserve la durée
        // stockée plutôt que de l'écraser avec null.
        const duration = videoMeta[vid]?.duration || existingDoc?.duration || null;
        const liveBroadcast = videoMeta[vid]?.live || existingDoc?.liveBroadcast || 'none';
        if (existingDoc) {
          // Backfill : re-applique TOUJOURS la source (prequeur, categorie,
          // sourceId/sourceName/channelHandle) — corrige les documents importes
          // avant que ces champs existent ou avec une mauvaise source.
          const updates = {
            sourceId: source._id,
            sourceName: source.name,
            channelHandle: source.channelHandle,
            preacher,
            category,
          };
          if (existingDoc.title !== title) updates.title = title;
          if (existingDoc.description !== description) updates.description = description;
          if (existingDoc.coverUrl !== coverUrl) updates.coverUrl = coverUrl;
          if (existingDoc.duration !== duration) updates.duration = duration;
          if (existingDoc.youtubeUrl !== youtubeUrl) updates.youtubeUrl = youtubeUrl;
          if (existingDoc.liveBroadcast !== liveBroadcast) updates.liveBroadcast = liveBroadcast;
          if (existingDoc.isPublished !== (source.autoPublish !== false)) updates.isPublished = source.autoPublish !== false;
          updates.lastSyncedAt = new Date();
          updates.syncStatus = 'ok';
          updates.syncError = null;
          await HousePreaching.findByIdAndUpdate(existingDoc._id, updates);
          totalUpdated++;
        } else {
          ops.push({
            create: HousePreaching.create({
              title,
              description,
              preacher,
              category,
              coverUrl,
              youtubeVideoId: vid,
              youtubeUrl,
              duration,
              liveBroadcast,
              publishedAt,
              isPublished: source.autoPublish !== false,
              isActive: true,
              lastSyncedAt: new Date(),
              syncStatus: 'ok',
              sourceId: source._id,
              sourceName: source.name,
              channelHandle: source.channelHandle,
            }),
          });
        }
      }

      // Exécuter les créations en parallèle
      const results = await Promise.allSettled(ops.map((o) => o.create));
      for (const r of results) {
        if (r.status === 'fulfilled') totalCreated++;
        else totalErrors++;
      }

      // Mettre à jour lastSyncedAt de la source
      await HousePreachingSource.findByIdAndUpdate(source._id, {
        lastSyncAt: new Date(),
        syncStatus: 'ok',
        syncError: null,
      });
    } catch (err) {
      totalErrors++;
      await HousePreachingSource.findByIdAndUpdate(source._id, {
        lastSyncAt: new Date(),
        syncStatus: 'error',
        syncError: err.message,
      }).catch(() => {});
    }
  }

  return { synced: totalCreated + totalUpdated, created: totalCreated, updated: totalUpdated, errors: totalErrors };
}

async function getSyncStatus(HousePreachingSource) {
  const sources = await HousePreachingSource.find({ platform: 'youtube' }).lean();
  return sources.map((s) => ({
    id: s._id,
    name: s.name,
    channelHandle: s.channelHandle,
    channelId: s.channelId,
    playlistId: s.playlistId,
    lastSyncAt: s.lastSyncAt,
    syncStatus: s.syncStatus,
    syncError: s.syncError,
    isActive: s.isActive,
  }));
}

module.exports = { syncFromYouTube, getSyncStatus, resolveChannelId, getUploadsPlaylistId };
