const express = require('express');
const router = express.Router();
const { sendAlert } = require('../../../../../dry/services/alert/alert.service');

// Dynamic import for ytdl-core
let ytdl = null;
try {
  ytdl = require('@distube/ytdl-core');
} catch (e) {
  console.warn('ytdl-core non disponible sur le serveur');
}

// POST / - validate and fetch metadata
router.post('/', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL invalide ou manquante',
      });
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return res.status(400).json({
        success: false,
        error: 'URL YouTube non valide',
      });
    }

    if (!ytdl) {
      return res.status(503).json({
        success: false,
        error: 'Service YouTube temporairement indisponible',
      });
    }

    const cleanUrl = url.includes('youtu.be')
      ? `https://www.youtube.com/watch?v=${url.split('/').pop()}`
      : url;

    const info = await ytdl.getInfo(cleanUrl);

    return res.json({
      success: true,
      data: {
        title: info.videoDetails?.title || 'Video sans titre',
        duration: info.videoDetails?.lengthSeconds || 0,
        thumbnail: info.videoDetails?.thumbnails?.[0]?.url || '',
        author: info.videoDetails?.author?.name || 'Auteur inconnu',
        viewCount: info.videoDetails?.viewCount || 0,
        publishDate: info.videoDetails?.publishDate || null,
        description: info.videoDetails?.description?.substring(0, 200) || '',
        formats: info.formats
          .map((f) => ({
            quality: f.qualityLabel || 'Inconnue',
            container: f.container || 'Inconnu',
            hasVideo: f.hasVideo || false,
            hasAudio: f.hasAudio || false,
            resolution: f.height ? `${f.height}p` : 'Audio',
            bitrate: f.audioBitrate || f.bitrate || 'Inconnu',
          }))
          .filter((f) => f.hasVideo || f.hasAudio),
      },
    });
  } catch (error) {
    const requestId = req.requestId || req.headers['x-request-id'] || 'no-request-id';
    const statusCode = Number(error?.statusCode || error?.status || 500);
    const routePath = String(req.originalUrl || '').split('?')[0];

    setImmediate(() => {
      sendAlert({
        event: 'DRY_API_EXCEPTION',
        status: 'ERROR',
        requestId,
        http: `${req.method} ${req.originalUrl}`,
        url: req.originalUrl,
        tenant: req.headers['x-tenant-id'] || req.headers['tenant-id'] || 'MediaDL',
        error,
        details: {
          module: 'MediaDL',
          routePath,
          provider: 'youtube',
          providerStatus: statusCode,
          publicMessage: `Erreur YouTube: ${error?.message || 'Erreur inconnue'}`,
        },
        request: {
          id: requestId,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          params: req.params,
          query: req.query,
          body: req.body,
        },
        dedupKey: `youtube-metadata:${statusCode}:${error?.code || ''}:${error?.message || ''}`,
        timestamp: new Date().toISOString(),
      }).catch((alertErr) => {
        console.error('Echec alerte YouTube metadata:', alertErr?.message || String(alertErr));
      });
    });

    console.error('Erreur metadonnees YouTube:', error?.message || String(error));
    return res.status(500).json({
      success: false,
      error: `Erreur YouTube: ${error?.message || 'Erreur inconnue'}`,
    });
  }
});

module.exports = router;
