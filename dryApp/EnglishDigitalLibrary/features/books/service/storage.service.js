const cloudinary = require('cloudinary').v2;
const config = require('../../../../../config/database');
const r2Storage = require('../../../../../dry/services/storage/r2ObjectStorage.service');

const configured = Boolean(config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET);
if (configured) cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET, secure: true });

function upload(buffer, options) {
  if (!configured) throw Object.assign(new Error('Private library storage is not configured.'), { statusCode: 503 });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => error ? reject(error) : resolve(result));
    stream.end(buffer);
  });
}

/** PDF files use shared private object storage; book covers stay on Cloudinary. */
async function uploadDocument(buffer, options = {}) {
  if (!r2Storage.configured) throw Object.assign(new Error('Cloudflare R2 is not configured for library PDFs.'), { statusCode: 503 });
  const folder = String(options.folder || 'english_digital_library/documents').replace(/^\/+|\/+$/g, '');
  const publicId = String(options.public_id || `${Date.now()}`).replace(/^\/+|\/+$/g, '');
  const result = await r2Storage.upload({ key: `${folder}/${publicId}.pdf`, body: buffer, contentType: 'application/pdf', cacheControl: 'private, no-store' });
  return { public_id: result.key, secure_url: r2Storage.objectUrl(result.key), storage_provider: 'r2', bytes: buffer.length };
}

async function remove(publicId, resourceType, provider = 'cloudinary') {
  if (provider === 'r2' && publicId) {
    try { await r2Storage.remove(publicId); }
    catch (error) { console.error('Library R2 document cleanup failed:', error.message); }
    return;
  }
  if (!configured || !publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: resourceType === 'raw' ? 'authenticated' : 'upload', invalidate: true }); }
  catch (error) { console.error('Library asset cleanup failed:', error.message); }
}

async function privatePdfUrl(publicId, attachment = false, provider = 'cloudinary') {
  if (provider === 'r2') {
    return r2Storage.signedReadUrl(publicId, {
      expiresIn: 300,
      ...(attachment ? { attachmentName: `${String(publicId).split('/').pop() || 'book'}.pdf` } : {}),
    });
  }
  if (!configured) throw Object.assign(new Error('Private library storage is not configured.'), { statusCode: 503 });
  return cloudinary.utils.private_download_url(publicId, 'pdf', { resource_type: 'raw', type: 'authenticated', attachment, expires_at: Math.floor(Date.now() / 1000) + 300 });
}

module.exports = { configured, documentConfigured: r2Storage.configured, upload, uploadDocument, remove, privatePdfUrl };
