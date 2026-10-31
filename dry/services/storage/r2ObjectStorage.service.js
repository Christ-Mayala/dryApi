const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../../config/database');

/** Build a reusable private object-storage client for R2 or another S3-compatible service. */
function createR2Storage(options = {}) {
  const bucket = options.bucket || config.R2_BUCKET_NAME;
  const accountId = options.accountId || config.R2_ACCOUNT_ID;
  const jurisdiction = options.jurisdiction || config.R2_JURISDICTION;
  const endpoint = options.endpoint || config.R2_ENDPOINT || (accountId ? `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com` : '');
  const accessKeyId = options.accessKeyId || config.R2_ACCESS_KEY_ID;
  const secretAccessKey = options.secretAccessKey || config.R2_SECRET_ACCESS_KEY;
  const prefix = String(options.prefix || '').replace(/^\/+|\/+$/g, '');
  const forcePathStyle = Boolean(options.forcePathStyle);
  const configured = Boolean(bucket && endpoint && accessKeyId && secretAccessKey);
  let client;

  function getClient() {
    if (!configured) {
      const error = new Error('Object storage is not configured. Set the R2 account, bucket, and access keys.');
      error.statusCode = 503;
      throw error;
    }
    if (!client) {
      client = new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
    return client;
  }

  function resolveKey(key) {
    const normalized = String(key || '').replace(/^\/+/, '');
    if (!normalized || normalized.split('/').includes('..')) throw new Error('A valid object key is required.');
    if (!prefix || normalized === prefix || normalized.startsWith(`${prefix}/`)) return normalized;
    return `${prefix}/${normalized}`;
  }

  return {
    configured,
    bucket,
    objectUrl(key) {
      const objectKey = resolveKey(key);
      const publicBase = config.R2_PUBLIC_BASE_URL || '';
      if (publicBase) return `${publicBase.replace(/\/+$/, '')}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
      const base = endpoint.replace(/\/+$/, '');
      const storageHost = forcePathStyle ? `${base}/${encodeURIComponent(bucket)}` : base.replace(/^([a-z]+:\/\/)(.+)$/, `$1${encodeURIComponent(bucket)}.$2`);
      return `${storageHost}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
    },
    async upload({ key, body, contentType = 'application/octet-stream', cacheControl, metadata }) {
      const objectKey = resolveKey(key);
      const result = await getClient().send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
        ...(metadata ? { Metadata: metadata } : {}),
      }));
      return { key: objectKey, bucket, etag: result.ETag || '' };
    },
    async remove(key) {
      await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: resolveKey(key) }));
    },
    async signedReadUrl(key, { expiresIn = 300, attachmentName } = {}) {
      const safeExpiry = Math.min(60 * 60, Math.max(30, Number(expiresIn) || 300));
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: resolveKey(key),
        ...(attachmentName ? { ResponseContentDisposition: `attachment; filename="${String(attachmentName).replace(/["\\\r\n]/g, '_')}"` } : {}),
      });
      return getSignedUrl(getClient(), command, { expiresIn: safeExpiry });
    },
    async get(key) {
      return getClient().send(new GetObjectCommand({ Bucket: bucket, Key: resolveKey(key) }));
    },
  };
}

const defaultStorage = createR2Storage();
module.exports = { ...defaultStorage, createR2Storage };
