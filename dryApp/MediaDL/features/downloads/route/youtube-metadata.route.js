const express = require('express');
const router = express.Router();
const ytdl = require('ytdl-core');

// POST /api/mediadl/youtube/metadata - Valider et récupérer métadonnées
router.post('/youtube/metadata', async (req, res) => {
  try {
    const { url } = req.body;
    
    // Validation basique
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'URL invalide ou manquante' 
      });
    }
    
    // Vérifier que c'est une URL YouTube
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL YouTube non valide' 
      });
    }
    
    // Nettoyer l'URL
    const cleanUrl = url.includes('youtu.be') ? 
      `https://www.youtube.com/watch?v=${url.split('/').pop()}` : 
      url;
    
    // Récupérer les métadonnées SANS télécharger
    const info = await ytdl.getInfo(cleanUrl);
    
    // Retourner les métadonnées essentielles
    res.json({
      success: true,
      data: {
        title: info.videoDetails?.title || 'Video sans titre',
        duration: info.videoDetails?.lengthSeconds || 0,
        thumbnail: info.videoDetails?.thumbnails?.[0]?.url || '',
        author: info.videoDetails?.author?.name || 'Auteur inconnu',
        viewCount: info.videoDetails?.viewCount || 0,
        publishDate: info.videoDetails?.publishDate || null,
        description: info.videoDetails?.description?.substring(0, 200) || '',
        formats: info.formats.map(f => ({
          quality: f.qualityLabel || 'Inconnue',
          container: f.container || 'Inconnu',
          hasVideo: f.hasVideo || false,
          hasAudio: f.hasAudio || false,
          resolution: f.height ? `${f.height}p` : 'Audio',
          bitrate: f.audioBitrate || f.bitrate || 'Inconnu'
        })).filter(f => f.hasVideo || f.hasAudio) // Garder que les formats utiles
      }
    });
    
  } catch (error) {
    console.error('Erreur métadonnées YouTube:', error.message);
    res.status(500).json({ 
      success: false, 
      error: `Erreur YouTube: ${error.message}` 
    });
  }
});

module.exports = router;
