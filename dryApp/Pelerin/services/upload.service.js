const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const os = require('os');
const config = require('../../../config/database');

/**
 * Upload Cloudinary specifique a Pelerin : images (couvertures) + audio
 * (episodes de podcast, chants). Le service kernel partage
 * (dry/services/cloudinary/cloudinary.service.js) n'autorise que
 * image/pdf — on ne le modifie pas (utilise par d'autres tenants), on
 * duplique la config ici avec un fileFilter et une limite de taille adaptes
 * a l'audio plutot que de toucher un module partage.
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
        folder: file.mimetype.startsWith('audio/') ? 'pelerin_audio' : 'pelerin_images',
        // Cloudinary route l'audio sous resource_type 'video' (pas de type
        // 'audio' dedie) ; 'auto' laisse Cloudinary detecter correctement.
        resource_type: 'auto',
        public_id: `${file.fieldname}-${Date.now()}`,
      }),
    })
  : multer.diskStorage({
      // Repli disque uniquement en dev si Cloudinary n'est pas configure.
      destination: (req, file, cb) => cb(null, os.tmpdir()),
      filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}`),
    });

// Les episodes de podcast peuvent peser plusieurs dizaines de Mo (30-60 min
// audio) — la limite globale est calee sur l'audio. multer ne peut pas
// connaitre la taille du fichier au moment de fileFilter (elle n'est connue
// qu'une fois le flux consomme), donc pas de limite distincte plus stricte
// pour les images ici : le vrai garde-fou est le type MIME autorise.
const MAX_UPLOAD_SIZE = 150 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (req, file, cb) => {
    if (!isCloudinaryConfigured && process.env.NODE_ENV === 'production') {
      return cb(new Error('Cloudinary non configure en production.'), false);
    }
    const isImage = file?.mimetype?.startsWith('image/');
    const isAudio = file?.mimetype?.startsWith('audio/');
    if (!isImage && !isAudio) {
      return cb(new Error('Type de fichier non supporte. Image ou audio uniquement.'), false);
    }
    return cb(null, true);
  },
});

module.exports = upload;
