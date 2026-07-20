const cloudinary = require('cloudinary').v2;
const config = require('../../../config/database');

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

/**
 * Supprime un asset Cloudinary (image ou audio) associe a un document
 * supprime/remplace — jamais bloquant : un echec ici ne doit jamais faire
 * echouer la suppression/mise a jour du document en base.
 */
async function deleteCloudinaryAsset(publicId, resourceType = 'image') {
  if (!publicId || !isCloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('[cloudinaryCleanup] echec suppression asset:', err.message);
  }
}

module.exports = { deleteCloudinaryAsset };
