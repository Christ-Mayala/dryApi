const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { httpError } = require('../../../../../dry/utils/http/httpError');
const HousePreachingSchema = require('../model/housePreaching.schema');
const HousePreachingListenSchema = require('../model/housePreachingListen.schema');
const HousePreachingFollowSchema = require('../model/housePreachingFollow.schema');

/**
 * Page HTML du lecteur YouTube (API IFrame), servie par le BACKEND à une URL
 * réelle (https://<hôte>/api/v1/pelerin/housepreaching/embed/youtube/:videoId).
 *
 * Pourquoi : la WebView mobile qui charge du HTML brut a une origine
 * about:blank/null — YouTube refuse alors de diffuser le flux (écran noir),
 * même pour des vidéos dont l'embedding est autorisé. En servant la page
 * depuis le backend, la WebView charge une URL réelle (origine https en
 * production, IP locale en dev) et la lecture fonctionne.
 *
 * La page dialogue avec React Native via window.ReactNativeWebView.postMessage
 * (bridge injecté par react-native-webview) : ready / progress / playerError.
 */
function buildEmbedHtml(videoId) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { background: #000; }
    #player { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    var player = null;
    var progressTimer = null;

    function post(msg) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (_) {}
    }

    function startProgress() {
      if (progressTimer) return;
      progressTimer = setInterval(function () {
        try {
          var cur = player.getCurrentTime();
          var dur = player.getDuration();
          post({ type: 'progress', positionMs: Math.round(cur * 1000), durationMs: Math.round(dur * 1000) });
        } catch (_) {}
      }, 2000);
    }

    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: ${JSON.stringify(videoId)},
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, fs: 1 },
        events: {
          onReady: function (e) {
            post({ type: 'ready' });
            try { e.target.playVideo(); } catch (_) {}
          },
          onStateChange: function (e) {
            // -1 non démarré, 0 terminé, 1 lecture, 2 pause, 3 buffering, 5 cued
            if (e.data === 1) startProgress();
            else if (e.data === 0 || e.data === 2) {
              if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
            }
          },
          onError: function (e) {
            // 2 paramètre invalide, 5 erreur HTML5, 100/101/150 embedding interdit, 153 indisponible
            post({ type: 'playerError', code: e.data });
          }
        }
      });
    }
  </script>
</body>
</html>`;
}

/**
 * GET /housePreaching/embed/youtube/:videoId — page HTML du lecteur YouTube.
 * Publique (pas d'auth : la WebView mobile ne porte pas de token).
 */
const getEmbedPage = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // Un videoId YouTube est [A-Za-z0-9_-]{11} — on refuse tout le reste.
  if (!/^[A-Za-z0-9_-]{6,}$/.test(String(videoId || ''))) {
    return res.status(400).type('html').send('<h1>videoId invalide</h1>');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(buildEmbedHtml(String(videoId)));
});

// GET /housePreaching/preachers - Prêcheurs distincts (onglets dynamiques de
// l'écran liste : dérivés des données, plus de noms codés en dur côté app).
const getPreachers = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const rows = await HousePreaching.aggregate([
    { $match: { isPublished: true, isActive: true, preacher: { $ne: null, $ne: '' } } },
    { $group: { _id: '$preacher', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return sendResponse(
    res,
    rows.map((r) => ({ preacher: r._id, count: r.count })),
    'Prêcheurs récupérés'
  );
});

// GET /housePreaching/follows — prêcheurs suivis par l'utilisateur connecté
// (source de vérité pour la synchro inter-appareils des boutons « Suivre »).
const getFollows = asyncHandler(async (req, res) => {
  const Follow = req.getModel('HousePreachingFollow', HousePreachingFollowSchema);
  const userId = String(req.user?._id || req.user?.id || '');
  if (!userId) throw httpError('Utilisateur introuvable', 401);
  const rows = await Follow.find({ userId }).sort({ createdAt: -1 }).limit(500);
  return sendResponse(
    res,
    rows.map((r) => r.preacher),
    'Prêcheurs suivis'
  );
});

// PUT /housePreaching/follows — remplace la liste complète des suivis
// (body: { preachers: [...] }). Le mobile l'appelle après un merge local,
// donc un simple « set » converge entre les appareils sans doublons.
const setFollows = asyncHandler(async (req, res) => {
  const Follow = req.getModel('HousePreachingFollow', HousePreachingFollowSchema);
  const userId = String(req.user?._id || req.user?.id || '');
  if (!userId) throw httpError('Utilisateur introuvable', 401);

  const list = Array.isArray(req.body?.preachers)
    ? req.body.preachers.map((p) => String(p).trim()).filter(Boolean).slice(0, 200)
    : [];
  const unique = Array.from(new Set(list));

  await Follow.deleteMany({ userId });
  if (unique.length > 0) {
    await Follow.insertMany(unique.map((preacher) => ({ userId, preacher })));
  }
  return sendResponse(res, unique, 'Prêcheurs suivis synchronisés');
});

// POST /housePreaching/follows — ajoute un prêcheur aux suivis (upsert).
const addFollow = asyncHandler(async (req, res) => {
  const Follow = req.getModel('HousePreachingFollow', HousePreachingFollowSchema);
  const userId = String(req.user?._id || req.user?.id || '');
  if (!userId) throw httpError('Utilisateur introuvable', 401);
  const preacher = String(req.body?.preacher || '').trim();
  if (!preacher) throw httpError('Prêcheur requis', 400);
  await Follow.updateOne(
    { userId, preacher },
    { $setOnInsert: { userId, preacher } },
    { upsert: true }
  );
  return sendResponse(res, { preacher, following: true }, 'Prêcheur suivi');
});

// DELETE /housePreaching/follows/:preacher — retire un prêcheur des suivis.
const removeFollow = asyncHandler(async (req, res) => {
  const Follow = req.getModel('HousePreachingFollow', HousePreachingFollowSchema);
  const userId = String(req.user?._id || req.user?.id || '');
  if (!userId) throw httpError('Utilisateur introuvable', 401);
  const preacher = String(req.params.preacher || '');
  await Follow.deleteOne({ userId, preacher });
  return sendResponse(res, { preacher, following: false }, 'Prêcheur retiré des suivis');
});

// POST /housePreaching/:id/progress - Sauvegarde la progression d'écoute d'une
// prédication (position/durée) pour la carte « Continuer ». Upsert par
// (userId, videoId) ; completed auto si ≥ 98 %.
const saveProgress = asyncHandler(async (req, res) => {
  const Listen = req.getModel('HousePreachingListen', HousePreachingListenSchema);
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);

  const userId = String(req.user?._id || req.user?.id || '');
  if (!userId) throw httpError('Utilisateur introuvable', 401);

  const video = await HousePreaching.findById(req.params.id);
  if (!video) throw httpError('Prédication introuvable', 404);

  const { positionMs = 0, durationMs = 0, completed } = req.body || {};
  const pos = Math.max(0, Number(positionMs) || 0);
  const dur = Math.max(0, Number(durationMs) || 0);
  const isCompleted = completed === true || (dur > 0 && pos / dur >= 0.98);

  await Listen.findOneAndUpdate(
    { userId, videoId: video._id },
    {
      positionMs: pos,
      durationMs: dur,
      completed: isCompleted,
      lastPlayedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return sendResponse(res, { saved: true, progress: dur > 0 ? Math.min(1, pos / dur) : 0 }, 'Progression enregistrée');
});

// GET /housePreaching - Liste publique (publiées + actives)
const getAll = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const { category, sort = 'new', search, page = 1, limit = 20, sourceId, channelHandle, preacher, preachers, liveBroadcast } = req.query;

  const query = { isPublished: true, isActive: true };
  if (category) query.category = category;
  if (search) query.title = { $regex: search, $options: 'i' };
  if (sourceId) query.sourceId = sourceId;
  if (channelHandle) query.channelHandle = channelHandle;
  // Filtre « Suivis » côté serveur : liste de prêcheurs suivis (séparés par
  // des virgules) → la pagination couvre TOUT le catalogue, pas seulement
  // les pages déjà chargées côté client.
  if (preachers) {
    const list = String(preachers).split(',').map((p) => p.trim()).filter(Boolean);
    if (list.length > 0) query.preacher = { $in: list };
  }
  // Filtre « En direct / Passé » : liveBroadcast=live → seulement en direct ;
  // liveBroadcast=passed → tout sauf en direct.
  if (liveBroadcast === 'live') query.liveBroadcast = 'live';
  if (liveBroadcast === 'passed') query.liveBroadcast = { $ne: 'live' };
  // Filtre par prêcheur (dédoublonnage Yves/Yvan) : les onglets « Ps. Yves » /
  // « Ps. Yvan » filtrent sur le prêcheur résolu (titre d'abord, canal ensuite)
  // plutôt que sur le canal, pour ne plus mélanger les deux pasteurs.
  if (preacher) query.preacher = preacher;

  const sortMap = {
    new: { publishedAt: -1 },
    popular: { viewCount: -1 },
    oldest: { publishedAt: 1 },
  };
  const sortObj = sortMap[sort] || sortMap.new;

  const p = Number(page);
  const l = Number(limit);

  const total = await HousePreaching.countDocuments(query);
  const items = await HousePreaching.find(query)
    .sort(sortObj)
    .skip((p - 1) * l)
    .limit(l);

  return sendResponse(res, items, 'Prédications récupérées', true, {
    page: p,
    limit: l,
    total,
    totalPages: Math.ceil(total / l),
  });
});

// GET /housePreaching/:id - Détail public
const getById = asyncHandler(async (req, res) => {
  const HousePreaching = req.getModel('HousePreaching', HousePreachingSchema);
  const item = await HousePreaching.findById(req.params.id);
  if (!item || !item.isPublished || !item.isActive) {
    throw httpError('Prédication introuvable', 404);
  }
  // Incrémente le compteur de vues
  await HousePreaching.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
  return sendResponse(res, item, 'Prédication récupérée');
});

// GET /housePreaching/continue - Dernière prédication commencée (reprise)
const getContinue = asyncHandler(async (req, res) => {
  const Listen = req.getModel('HousePreachingListen', HousePreachingListenSchema);
  const userId = req.user._id;
  if (!userId) return sendResponse(res, null, 'Progression');

  const listen = await Listen.findOne({ userId, completed: false })
    .sort({ lastPlayedAt: -1 })
    .populate('videoId');

  if (!listen || !listen.videoId) return sendResponse(res, null, 'Progression');
  const video = listen.videoId;
  const progress = listen.durationMs > 0 ? listen.positionMs / listen.durationMs : 0;
  return sendResponse(
    res,
    { ...video.toObject(), progress, lastPositionMs: listen.positionMs },
    'Progression'
  );
});

module.exports = {
  getAll,
  getById,
  getContinue,
  getEmbedPage,
  getPreachers,
  saveProgress,
  getFollows,
  setFollows,
  addFollow,
  removeFollow,
};
