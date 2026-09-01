/**
 * Service « Audio chrétien depuis YouTube » (dryApp/Pelerin).
 *
 * Deux rôles :
 *  1. EXTRACTION AUDIO (écoute hors application / en arrière-plan) : un
 *     videoId YouTube → URL de flux audio directe.
 *     Méthode principale : `yt-dlp` (`-f bestaudio -g`), installé via
 *     `pip3 install yt-dlp` dans le Build Command de Render (voir render.yaml).
 *     Fallback automatique : `@distube/ytdl-core` (pure Node.js, sans binaire)
 *     si yt-dlp est absent (ENOENT). Le mobile lit cette URL avec expo-audio :
 *     écran éteint, notification, écran verrouillé, vitesse, sleep timer.
 *     Les URLs YouTube sont signées et expirent (~6 h) : on les met en cache
 *     30 min (yt-dlp) / 5 min (fallback ytdl-core), jamais en base.
 *
 *  2. DÉCOUVERTE AUTOMATIQUE (bibliothèque Audio) : recherche sur YouTube
 *     (Data API, clé partagée avec les prédications) de contenus chrétiens
 *     francophones (louange, gospel, prédications, enseignements), filtrés
 *     pour ne garder QUE des titres chrétiens, et importés dans AudioTrack
 *     (source='youtube', youtubeVideoId) — lus au même titre que les autres
 *     pistes.
 *
 * Configuration :
 *   YOUTUBE_AUDIO_SYNC_ENABLED  = true/false        (défaut: true)
 *   YOUTUBE_AUDIO_SYNC_CRON     = expression cron   (défaut: 0 5 * * *)
 *   YOUTUBE_AUDIO_QUERIES       = q1,q2,…           (défaut: liste FR ci-dessous)
 *   YOUTUBE_AUDIO_MAX           = nombre max de pistes YouTube (défaut: 800)
 *   YTDLP_BIN                   = chemin yt-dlp      (défaut: yt-dlp dans le PATH)
 */
const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execFileAsync = promisify(execFile);

const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const MAX_AUDIO_TRACKS = Math.max(50, parseInt(process.env.YOUTUBE_AUDIO_MAX || '800', 10) || 800);

// Clients YouTube utilisés par yt-dlp pour l'extraction. Le client web par
// défaut est bloqué par l'anti-bot de YouTube (HTTP 429 « Too Many Requests »
// sur les IP de serveur) : les clients android/ios/tv ne le sont pas (ou
// beaucoup moins) et fournissent un flux exploitable. L'audio pur (m4a) est
// parfois indisponible (expérience SABR) → le fallback `best` renvoie un mp4
// audio+vidéo (itag 18) que le lecteur audio joue sans souci.
const YTDLP_EXTRACTOR_ARGS = 'youtube:player_client=android,ios,tv';
const YTDLP_ARGS_BASE = [
  '-f', 'bestaudio/best',
  '-g',
  '--no-playlist',
  '--extractor-args', YTDLP_EXTRACTOR_ARGS,
];

/**
 * Construit les arguments yt-dlp en injectant les cookies si disponibles.
 * Cookies acceptés sous deux formats via variables d'env :
 *   YTDLP_COOKIES_FILE   = chemin absolu vers un fichier cookies Netscape
 *   YTDLP_COOKIES        = contenu Netscape brut (sera écrit dans /tmp)
 */
function buildYtdlpArgs(videoUrl) {
  const args = [...YTDLP_ARGS_BASE];

  const cookiesFile = process.env.YTDLP_COOKIES_FILE;
  const cookiesContent = process.env.YTDLP_COOKIES;

  if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  } else if (cookiesContent) {
    // Écrit les cookies dans un fichier temporaire à la première utilisation
    // (évite de créer un fichier à chaque requête).
    if (!buildYtdlpArgs._tmpFile) {
      const os = require('os');
      const path = require('path');
      const fs = require('fs');
      const tmpPath = path.join(os.tmpdir(), 'yt-cookies.txt');
      try {
        fs.writeFileSync(tmpPath, cookiesContent, 'utf8');
        buildYtdlpArgs._tmpFile = tmpPath;
      } catch { /* silencieux : on continue sans cookies */ }
    }
    if (buildYtdlpArgs._tmpFile) {
      args.push('--cookies', buildYtdlpArgs._tmpFile);
    }
  }

  args.push(videoUrl);
  return args;
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const DEFAULT_QUERIES = [
  'louange chrétienne',
  'musique chrétienne française',
  'gospel chrétien',
  'prédication chrétienne',
  'enseignement biblique',
  'adoration chants chrétiens',
  'méditation chrétienne',
  'prière chrétienne musique',
  // Chansons / artistes demandés : rap gospel, adoration, et les grands noms
  // du gospel congolais (Daniel Banam, Dena Mwana, Moïse Mbiye, Mike Kalambay,
  // S'Vida…) — le filtre « chrétien uniquement » ne garde que les titres
  // de ces artistes qui parlent de Dieu/Jésus.
  'rap gospel français chrétien',
  'adoration chrétienne',
  'Daniel Banam gospel',
  'Dena Mwana',
  'David Cabasele',
  'Moise Mbiye',
  'Mike Kalambay',
  "S'Vida gospel",
];

const QUERIES = (process.env.YOUTUBE_AUDIO_QUERIES || DEFAULT_QUERIES.join(','))
  .split(',')
  .map((q) => q.trim())
  .filter(Boolean);

// ─── Filtre « chrétien uniquement » ─────────────────────────────────────────
// Marqueurs POSITIFS (au moins un requis) et NÉGATIFS (exclusion absolue) —
// le titre ET la chaîne doivent passer, sinon la vidéo est ignorée.
const CHRISTIAN_MARKERS = [
  'jésus', 'jesus', 'christ', 'dieu', 'seigneur', 'chrétien', 'chretien',
  'église', 'eglise', 'louange', 'adoration', 'gospel', 'prière', 'priere',
  'évangile', 'evangile', 'bible', 'esprit saint', 'parole de dieu', 'amen',
  'alléluia', 'alleluia', 'hallelujah', 'catholique', 'protestant', 'pasteur',
  'apôtre', 'apotre', 'saint-esprit', 'roi des rois', 'je suis', 'yeshua',
  'éternel', 'eternel', 'béni', 'beni', 'seigneur dieu', 'abba',
];
const NON_CHRISTIAN_MARKERS = [
  'islam', 'musulman', 'coran', 'bouddh', 'hindou', 'sorcellerie', 'occult',
  'marabout', 'sataniste', 'satan', 'ésotér', 'esoter', 'démon', 'demon',
  'kabbale', 'franc-maçon', 'franc-macon', 'païen', 'pagan', 'vaudou',
  'horoscope', 'astrologie', 'spiritisme', 'ghost', 'horreur', 'comédie',
  'comedy', 'football', 'jeux vidéo', 'gaming', 'film', 'bande-annonce',
  'tuto', 'tutorial', 'recette', 'cuisine', 'actualité politique', 'rap ',
];

function isChristianText(text) {
  const hay = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Le normalisé retire les accents : on normalise aussi les marqueurs.
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const m of NON_CHRISTIAN_MARKERS) {
    if (hay.includes(norm(m))) return false;
  }
  return CHRISTIAN_MARKERS.some((m) => hay.includes(norm(m)));
}

function isChristian(video) {
  const text = `${video.title || ''} ${video.channelTitle || ''}`;
  return isChristianText(text);
}

/**
 * Variante « chaîne/playlist choisie explicitement par l'admin » : on garde
 * l'EXCLUSION des contenus clairement non chrétiens (islam, films, comédie,
 * sport, tutos…) mais on n'exige PLUS de marqueur positif. Les chansons
 * d'un artiste gospel en lingala (« Fongola », « Mokonzi »…) n'ont souvent
 * aucun mot français/anglais chrétien dans le titre — les exiger ferait
 * perdre 80 % du catalogue d'une chaîne officielle.
 */
function isChristianLoose(video) {
  const hay = String(`${video.title || ''} ${video.channelTitle || ''}`)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return !NON_CHRISTIAN_MARKERS.some((m) => hay.includes(norm(m)));
}

// ─── Extraction du flux audio ────────────────────────────────────────────────
//
// Stratégie à trois niveaux (ordre de priorité) :
//   1. yt-dlp + cookies (méthode principale) : binaire installé via postinstall.
//      Avec YTDLP_COOKIES ou YTDLP_COOKIES_FILE contourne le 429 sur datacenter.
//   2. Piped API (fallback sans binaire, sans cookies) : appel HTTP à une
//      instance Piped publique (frontend YouTube open-source). L'URL retournée
//      passe par le proxy de Piped — YouTube ne voit pas l'IP de Render.
//      Gratuit, aucune dépendance native. Instances tournantes en rotation.
//   3. @distube/ytdl-core (dernier recours) : si Piped est down ou bloqué.

// Instances Piped publiques en rotation — on essaie dans l'ordre, on passe
// à la suivante si une échoue (down, rate-limit, etc.).
const PIPED_INSTANCES = (process.env.PIPED_INSTANCES || [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.projectsegfau.lt',
  'https://piped-api.codespace.cz',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Résout l'URL audio via l'API Piped (fallback sans binaire ni cookies).
 * Essaie les instances dans l'ordre jusqu'à en trouver une qui fonctionne.
 * @param {string} id  videoId YouTube validé
 * @returns {Promise<string>} URL du flux audio (proxifiée par Piped)
 */
async function _getAudioUrlViaPiped(id) {
  let lastErr;
  for (const instance of PIPED_INSTANCES) {
    try {
      const { data } = await axios.get(`${instance}/streams/${id}`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      // Choisit le flux audio avec le meilleur débit.
      const streams = Array.isArray(data.audioStreams) ? data.audioStreams : [];
      if (!streams.length) continue;
      const best = streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (best?.url && /^https?:\/\//.test(best.url)) {
        return best.url;
      }
    } catch (err) {
      lastErr = err;
      // Instance down ou rate-limit : on tente la suivante
    }
  }
  const msg = lastErr?.message || 'Toutes les instances Piped ont échoué';
  const e = new Error(`Extraction audio impossible via Piped (${msg})`);
  e.statusCode = 502;
  throw e;
}

const audioUrlCache = new Map(); // videoId -> { url, expiresAt }

/**
 * Extrait l'URL audio via @distube/ytdl-core (fallback sans yt-dlp).
 * Utilise uniquement les player clients IOS/ANDROID (non bloqués par YouTube
 * sur les IPs de datacenter). Si YOUTUBE_COOKIES est défini en variable
 * d'environnement (JSON exporté depuis EditThisCookie), il est utilisé pour
 * passer le rate-limit YouTube (429).
 * @param {string} id  videoId YouTube validé
 * @returns {Promise<string>} URL du flux audio
 */
async function _getAudioUrlViaYtdlCore(id) {
  const ytdl = require('@distube/ytdl-core');

  // Cookies optionnels : réduisent drastiquement le risque de 429 sur serveur.
  // Exporter les cookies YouTube depuis le navigateur (format JSON EditThisCookie)
  // et les mettre dans YOUTUBE_COOKIES (variable d'env Render).
  let agent;
  try {
    const cookiesEnv = process.env.YOUTUBE_COOKIES;
    if (cookiesEnv) {
      const cookies = JSON.parse(cookiesEnv);
      agent = ytdl.createAgent(cookies);
    }
  } catch {
    // Cookies malformés : on continue sans
  }

  const options = {
    // IOS et ANDROID ne sont pas bloqués par l'anti-bot YouTube sur les
    // IPs de datacenter contrairement au client WEB.
    playerClients: ['IOS', 'ANDROID'],
    requestOptions: { maxRetries: 3 },
  };
  if (agent) options.agent = agent;

  const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${id}`, options);

  // Choisit le meilleur format audio seul (m4a/webm), ou le meilleur format
  // général si l'audio seul n'est pas disponible (ex. SABR uniquement).
  let format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
  if (!format) {
    format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
  }
  if (!format || !format.url) {
    const e = new Error('Aucun flux audio disponible pour cette vidéo (ytdl-core).');
    e.statusCode = 502;
    throw e;
  }
  return format.url;
}

/**
 * URL de flux audio directe pour un videoId YouTube.
 * Cache 30 min (méthode principale) / 5 min (fallback ytdl-core).
 * Tente d'abord yt-dlp ; si absent, bascule automatiquement sur @distube/ytdl-core.
 * @param {string} videoId
 * @returns {Promise<string>}
 */
async function getYoutubeAudioUrl(videoId) {
  const id = String(videoId || '');
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) {
    const err = new Error('videoId invalide');
    err.statusCode = 400;
    throw err;
  }

  const cached = audioUrlCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.url) return cached.url;
    // Échec récent mis en cache : évite de marteler YouTube (ex. 429).
    const e = new Error(cached.error || 'Extraction audio impossible (réessaie dans quelques instants)');
    e.statusCode = cached.statusCode || 502;
    throw e;
  }

  // ── Tentative 1 : yt-dlp ────────────────────────────────────────────────
  let stdout = '';
  let ytdlpMissing = false;

  try {
    const { stdout: out } = await execFileAsync(
      YTDLP_BIN,
      buildYtdlpArgs(`https://www.youtube.com/watch?v=${id}`),
      { timeout: 45000, maxBuffer: 2 * 1024 * 1024, windowsHide: true },
    );
    stdout = String(out || '');
  } catch (err) {
    const message = String(err?.stderr || err?.message || err || '');
    // ENOENT = binaire absent → bascule sur le fallback
    if (err?.code === 'ENOENT' || /ENOENT|not found|no such file/i.test(message)) {
      ytdlpMissing = true;
      console.warn('[youtubeAudio] yt-dlp introuvable — utilisation du fallback @distube/ytdl-core');
    } else {
      const firstLine = message.split('\n').find((l) => l.trim()) || message;
      const friendly = firstLine.slice(0, 200);
      audioUrlCache.set(id, {
        url: null,
        error: `Extraction audio impossible (${friendly})`,
        statusCode: /429/.test(friendly) ? 503 : 502,
        expiresAt: Date.now() + 2 * 60 * 1000,
      });
      const e = new Error(`Extraction audio impossible (${friendly})`);
      e.statusCode = /429/.test(friendly) ? 503 : 502;
      throw e;
    }
  }

  // yt-dlp a réussi : extraire l'URL de stdout
  if (!ytdlpMissing) {
    const url = stdout.trim().split('\n')[0];
    if (!url || !/^https?:\/\//.test(url)) {
      const e = new Error('Aucun flux audio disponible pour cette vidéo.');
      e.statusCode = 502;
      throw e;
    }
    audioUrlCache.set(id, { url, expiresAt: Date.now() + 30 * 60 * 1000 });
    return url;
  }

  // ── Tentative 2 : Piped API (fallback sans binaire ni cookies) ───────────
  try {
    const url = await _getAudioUrlViaPiped(id);
    // Cache 20 min : les URLs Piped expirent plus vite que celles de yt-dlp.
    audioUrlCache.set(id, { url, expiresAt: Date.now() + 20 * 60 * 1000 });
    return url;
  } catch (pipedErr) {
    // Piped a échoué (toutes instances down) → on tente ytdl-core en dernier recours
    console.warn('[youtubeAudio] Piped a échoué, tentative ytdl-core:', pipedErr.message);
  }

  // ── Tentative 3 : @distube/ytdl-core (dernier recours) ───────────────────
  try {
    const url = await _getAudioUrlViaYtdlCore(id);
    // Cache plus court (5 min) : ces URLs sont liées à l'IP du serveur
    // et expireront côté YouTube si l'IP change entre le cache et la lecture.
    audioUrlCache.set(id, { url, expiresAt: Date.now() + 5 * 60 * 1000 });
    return url;
  } catch (fallbackErr) {
    const msg = String(fallbackErr?.message || fallbackErr).slice(0, 200);
    audioUrlCache.set(id, {
      url: null,
      error: `Extraction audio impossible (${msg})`,
      statusCode: fallbackErr?.statusCode || 502,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });
    const e = new Error(`Extraction audio impossible (${msg})`);
    e.statusCode = fallbackErr?.statusCode || 502;
    throw e;
  }
}

// ─── Découverte automatique (YouTube Data API) ───────────────────────────────

const SEARCH_CACHE_MS = 6 * 60 * 60 * 1000; // 6 h : économise le quota
let lastSearchAt = 0;

/** Durée ISO8601 (PT1H2M3S) → « 1:02:03 » / « 4:05 ». */
function formatIsoDuration(iso) {
  if (!iso) return '';
  const match = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Catégorisation RÉELLE d'une vidéo (titre + chaîne + description), pas de la
 * requête de recherche : une chanson d'adoration de Dena Mwana ou Mbiye est
 * classée « louange », un chant de Daniel Banam « gospel », un sermon
 * « enseignement ». Priorité : enseignement > louange > gospel.
 */
const GOSPEL_ARTISTS = ['daniel banam', 'david cabasele', "s'vida", 's.vida', 'svida'];
const WORSHIP_ARTISTS = ['moise mbiye', 'mike kalambay', 'dena mwana'];

// Marqueurs normalisés (sans accents) par catégorie.
const CATEGORY_MARKERS = {
  enseignement: [
    'predication', 'sermon', 'enseignement', 'etude biblique', 'etude de la bible',
    'bible study', 'conference', 'retraite', 'seminaire', 'message ', 'culte ',
  ],
  louange: [
    'louange', 'adoration', 'worship', 'praise', 'priere', 'meditation', 'hymne',
    'chorale', 'cantique', 'recueil', 'spontane', 'instrumental', 'piano', 'orgue',
    'intercession', 'rendre gloire',
  ],
  gospel: ['gospel', 'rap chretien', 'chant chretien', 'chanson chretienne', 'chantons'],
};

function categorizeTrack(video, fallback = 'louange') {
  const text = String(`${video.title || ''} ${video.channelTitle || ''} ${video.description || ''}`)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const marker of CATEGORY_MARKERS.enseignement) {
    if (text.includes(marker)) return 'enseignement';
  }
  if (
    CATEGORY_MARKERS.louange.some((m) => text.includes(m)) ||
    WORSHIP_ARTISTS.some((a) => text.includes(a))
  ) {
    return 'louange';
  }
  if (
    CATEGORY_MARKERS.gospel.some((m) => text.includes(m)) ||
    GOSPEL_ARTISTS.some((a) => text.includes(a))
  ) {
    return 'gospel';
  }
  return fallback;
}

/** Associe une requête de recherche à une catégorie AudioTrack (fallback). */
function categoryForQuery(query) {
  const q = String(query || '').toLowerCase();
  if (q.includes('rap')) return 'gospel';
  if (q.includes('gospel')) return 'gospel';
  if (GOSPEL_ARTISTS.some((a) => q.includes(a))) return 'gospel';
  if (q.includes('louange') || q.includes('adoration') || q.includes('musique') || q.includes('chant') || q.includes('prière') || q.includes('priere')) {
    return 'louange';
  }
  return 'enseignement';
}

async function searchChristianVideos() {
  const ids = new Set();
  const byId = new Map();

  for (const query of QUERIES) {
    const params = {
      part: 'snippet',
      q: query,
      type: 'video',
      relevanceLanguage: 'fr',
      safeSearch: 'none',
      order: 'relevance',
      maxResults: 20,
      key: YOUTUBE_API_KEY,
    };
    const { data } = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params,
      timeout: 15000,
    });
    for (const item of data.items || []) {
      const videoId = item?.id?.videoId;
      const snippet = item?.snippet || {};
      if (!videoId || !snippet.title) continue;
      if (ids.has(videoId)) continue;
      if (!isChristian(snippet)) continue;
      ids.add(videoId);
      byId.set(videoId, {
        videoId,
        title: snippet.title,
        channelTitle: snippet.channelTitle || '',
        description: snippet.description || '',
        coverUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        // Catégorie par CONTENU (titre + chaîne), pas par requête.
        category: categorizeTrack(snippet),
      });
    }
  }

  // Durées (contentDetails) par lots de 50.
  const idsArr = Array.from(ids);
  for (let i = 0; i < idsArr.length; i += 50) {
    const chunk = idsArr.slice(i, i + 50);
    const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'contentDetails,snippet',
        id: chunk.join(','),
        key: YOUTUBE_API_KEY,
      },
      timeout: 15000,
    });
    for (const item of data.items || []) {
      const meta = byId.get(item.id);
      if (!meta) continue;
      meta.duration = formatIsoDuration(item.contentDetails?.duration);
      // Rafraîchit la miniature officielle si dispo.
      const thumb = item.snippet?.thumbnails?.high?.url;
      if (thumb) meta.coverUrl = thumb;
      // Ignore les directs permanents (pas de durée exploitable).
      if (!meta.duration) byId.delete(item.id);
    }
  }

  return Array.from(byId.values());
}

/** Extrait un playlistId depuis une URL YouTube (list=…) ou retourne tel quel. */
function parsePlaylistId(input) {
  const s = String(input || '').trim();
  const m = s.match(/[?&]list=([A-Za-z0-9_-]{8,})/);
  return m ? m[1] : s;
}

/**
 * Importe TOUTES les vidéos d'une playlist YouTube choisie par l'admin
 * (dédup par youtubeVideoId, filtre « chrétien uniquement » appliqué au
 * titre + chaîne). Cap 400 vidéos par import.
 * @param {import('mongoose').Model} Track Modèle AudioTrack
 * @param {string} playlistIdOrUrl URL ou ID de la playlist
 * @param {string} category catégorie AudioTrack (défaut: gospel)
 * @returns {Promise<object>} rapport
 */
async function importYoutubePlaylist(Track, playlistIdOrUrl, category = 'gospel') {
  if (!YOUTUBE_API_KEY) {
    return { imported: 0, skipped: 0, already: 0, total: 0, errors: 1, message: 'YOUTUBE_API_KEY manquante' };
  }
  const playlistId = parsePlaylistId(playlistIdOrUrl);
  if (!/^[A-Za-z0-9_-]{8,}$/.test(playlistId)) {
    return { imported: 0, skipped: 0, already: 0, total: 0, errors: 1, message: `Playlist invalide : ${playlistIdOrUrl}` };
  }

  const items = [];
  let pageToken = null;
  do {
    const params = { part: 'snippet', playlistId, maxResults: 50, key: YOUTUBE_API_KEY };
    if (pageToken) params.pageToken = pageToken;
    const { data } = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, { params, timeout: 15000 });
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || null;
    if (items.length >= 400) break;
  } while (pageToken);

  const videos = items
    .map((i) => i?.snippet)
    .filter((s) => s && s.resourceId?.kind === 'youtube#video' && s.title)
    .map((s) => ({
      videoId: s.resourceId.videoId,
      title: s.title,
      channelTitle: s.videoOwnerChannelTitle || s.channelTitle || '',
      description: s.description || '',
      coverUrl: s.thumbnails?.maxres?.url || s.thumbnails?.high?.url || s.thumbnails?.medium?.url || '',
    }));

  // Durées par lots de 50 (quota).
  const meta = {};
  for (let i = 0; i < videos.length; i += 50) {
    const chunk = videos.slice(i, i + 50).map((v) => v.videoId);
    try {
      const { data } = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
        params: { part: 'contentDetails', id: chunk.join(','), key: YOUTUBE_API_KEY },
        timeout: 15000,
      });
      for (const v of data.items || []) meta[v.id] = formatIsoDuration(v.contentDetails?.duration);
    } catch (_) { /* un lot en échec ne bloque pas l'import */ }
  }

  let imported = 0;
  let skipped = 0;
  let already = 0;
  for (const v of videos) {
    // Chaîne/playlist CHOISIE par l'admin : filtre souple (exclusion des
    // non-chrétiens) pour ne pas perdre les titres en lingala/swahili.
    if (!isChristianLoose(v)) {
      skipped += 1;
      continue;
    }
    const exists = await Track.findOne({ youtubeVideoId: v.videoId }).select('_id');
    if (exists) {
      already += 1;
      continue;
    }
    await Track.create({
      title: v.title.slice(0, 200),
      artist: v.channelTitle.slice(0, 120),
      // Catégorie réelle par contenu ; la catégorie choisie par l'admin
      // (fallback) n'est utilisée que si aucun marqueur ne correspond.
      category: categorizeTrack(v, category),
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      coverUrl: v.coverUrl,
      duration: meta[v.videoId] || '',
      source: 'youtube',
      youtubeVideoId: v.videoId,
    });
    imported += 1;
  }

  return {
    imported,
    skipped,
    already,
    total: videos.length,
    message: `${imported} importée(s), ${already} déjà présente(s), ${skipped} ignorée(s) (non chrétien / doublon)`,
  };
}

/**
 * Synchronise la bibliothèque Audio chrétienne depuis YouTube (upsert par
 * youtubeVideoId, cap global). Appelé par le cron et le bouton admin.
 * @param {import('mongoose').Model} Track Modèle AudioTrack
 * @returns {Promise<object>} rapport
 */
async function syncYoutubeAudioTracks(Track) {
  if (!YOUTUBE_API_KEY) {
    return { imported: 0, skipped: 0, errors: 1, message: 'YOUTUBE_API_KEY manquante' };
  }

  try {
    // Cache 6 h : le cron quotidien reste sans effet pendant ce délai (quota).
    const now = Date.now();
    if (now - lastSearchAt < SEARCH_CACHE_MS) {
      return { imported: 0, skipped: 0, errors: 0, message: 'Recherche en cache (réessaye dans quelques heures)' };
    }

    const videos = await searchChristianVideos();
    lastSearchAt = now;

    const total = await Track.countDocuments({ source: 'youtube' });
    let imported = 0;
    let skipped = 0;
    const byCategory = { gospel: 0, louange: 0, enseignement: 0 };

    for (const v of videos) {
      if (total + imported >= MAX_AUDIO_TRACKS) {
        skipped += 1;
        continue;
      }
      const exists = await Track.findOne({ youtubeVideoId: v.videoId }).select('_id');
      if (exists) {
        // Met à jour les métadonnées (miniature, durée) sans doublon.
        await Track.updateOne(
          { _id: exists._id },
          { $set: { duration: v.duration || undefined, coverUrl: v.coverUrl || undefined } },
        );
        skipped += 1;
        continue;
      }
      await Track.create({
        title: v.title.slice(0, 200),
        artist: v.channelTitle.slice(0, 120),
        category: v.category,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        coverUrl: v.coverUrl,
        duration: v.duration,
        source: 'youtube',
        youtubeVideoId: v.videoId,
      });
      imported += 1;
      byCategory[v.category] = (byCategory[v.category] || 0) + 1;
    }

    return {
      imported,
      skipped,
      errors: 0,
      total,
      byCategory,
      message: `${imported} piste(s) ajoutée(s), ${skipped} ignorée(s) (déjà présentes / hors cap)`,
    };
  } catch (err) {
    console.error('[YOUTUBE-AUDIO] ❌ Sync échouée:', err.message);
    return { imported: 0, skipped: 0, errors: 1, message: err.message };
  }
}

module.exports = {
  getYoutubeAudioUrl,
  syncYoutubeAudioTracks,
  importYoutubePlaylist,
  parsePlaylistId,
  isChristian,
  formatIsoDuration,
  categorizeTrack,
  categoryForQuery,
  QUERIES,
  DEFAULT_QUERIES,
};
