const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const os = require('os');

const config = require('../../../../../config/database');
const sendResponse = require('../../../../../dry/utils/http/response');
const { protect } = require('../../../../../dry/middlewares/protection/auth.middleware');

const router = express.Router();

/**
 * Upload des medias Nova : images, videos et audios issus de l'appareil de
 * l'utilisateur. Le service kernel partage
 * (dry/services/cloudinary/cloudinary.service.js) n'accepte que image/pdf et
 * sert a l'avatar du profil — on ne le modifie pas. On duplique ici une
 * configuration dediee (Cloudinary, dossier nova_medias, limite 50 Mo) pour ne
 * pas toucher a un module partage.
 */
const isCloudinaryConfigured = !!(
  config.CLOUDINARY_CLOUD_NAME &&
  config.CLOUDINARY_API_KEY &&
  config.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
  });
}

const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder: 'nova_medias',
        resource_type: 'auto',
        public_id: `${file.fieldname}-${Date.now()}`,
      }),
    })
  : multer.diskStorage({
      // Repli disque uniquement lorsque Cloudinary n'est pas configure (dev).
      destination: (req, file, cb) => cb(null, os.tmpdir()),
      filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}`),
    });

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!isCloudinaryConfigured && process.env.NODE_ENV === 'production') {
      return cb(new Error('Le stockage Cloudinary n’est pas configuré en production.'), false);
    }
    const mime = file?.mimetype || '';
    const ok = mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/');
    if (!ok) {
      return cb(
        new Error('Type de fichier non pris en charge. Images, vidéos et audios uniquement.'),
        false
      );
    }
    return cb(null, true);
  },
});

/** Enveloppe multer afin de renvoyer les erreurs d'upload en JSON clair (400). */
const televerser = (req, res, next) => {
  upload.single('fichier')(req, res, (erreur) => {
    if (!erreur) return next();

    if (erreur instanceof multer.MulterError && erreur.code === 'LIMIT_FILE_SIZE') {
      return sendResponse(
        res,
        null,
        'Le fichier dépasse la taille maximale autorisée (50 Mo).',
        false,
        undefined,
        400
      );
    }

    if (erreur instanceof multer.MulterError && erreur.code === 'LIMIT_UNEXPECTED_FILE') {
      return sendResponse(
        res,
        null,
        'Champ de fichier inattendu. Utilisez le champ « fichier ».',
        false,
        undefined,
        400
      );
    }

    return sendResponse(
      res,
      null,
      erreur.message || 'Échec du téléversement du fichier.',
      false,
      undefined,
      400
    );
  });
};

// POST /api/v1/nova/medias — televersement authentifie d'un media local.
router.post('/', protect, televerser, (req, res, next) => {
  try {
    if (!req.file) {
      return sendResponse(
        res,
        null,
        'Aucun fichier reçu. Utilisez le champ « fichier ».',
        false,
        undefined,
        400
      );
    }

    // Cloudinary expose l'URL dans `path` (alias de `secure_url`) ; le repli
    // disque ne fournit qu'un `path` de fichier temporaire.
    const url = req.file.path || req.file.secure_url || req.file.url || null;
    if (!url) {
      return sendResponse(
        res,
        null,
        'Le stockage du fichier n’a retourné aucune URL.',
        false,
        undefined,
        400
      );
    }

    return sendResponse(res, {
      url,
      nom: req.file.originalname,
      type: req.file.mimetype,
      taille: req.file.size,
    }, 'Média téléversé avec succès.');
  } catch (erreur) {
    return next(erreur);
  }
});

module.exports = router;
