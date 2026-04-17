const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const config = require('../../../config/database');

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folderName = 'dry_app_uploads';

    if (file.mimetype === 'application/pdf') {
      folderName = 'dry_app_documents';
    }

    return {
      folder: folderName,
      resource_type: 'auto',
      public_id: `${file.fieldname}-${Date.now()}`,
    };
  },
});

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ok = file?.mimetype?.startsWith('image/') || file?.mimetype === 'application/pdf';
    if (!ok) return cb(new Error('Type de fichier non supporte. Images/PDF uniquement.'), false);
    return cb(null, true);
  },
});

module.exports = upload;
