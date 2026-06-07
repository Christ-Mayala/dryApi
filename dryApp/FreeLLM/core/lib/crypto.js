const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

let cachedKey = null;

const KEY_BYTES = 32;
const KEY_HEX_LEN = KEY_BYTES * 2;

function parseHexKey(value, source) {
  if (value.length !== KEY_HEX_LEN || !/^[0-9a-fA-F]+$/.test(value)) {
    throw new Error(
      `Invalid ENCRYPTION_KEY (${source}): expected ${KEY_HEX_LEN} hex chars (32 bytes), got ${value.length} chars. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return Buffer.from(value, 'hex');
}

async function initEncryptionKey(SettingsModel) {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey !== 'your-64-char-hex-key-here') {
    cachedKey = parseHexKey(envKey, 'env');
    return;
  }

  if (!envKey) {
    console.warn(
      '\x1b[33m⚠️  WARNING: ENCRYPTION_KEY env var not set!\x1b[0m\n' +
      '    FreeLLM API keys are encrypted with a key stored in MongoDB.\n' +
      '    If the database is wiped or the server restarts with a different DB, ALL API keys become undecryptable.\n' +
      '    Fix: add ENCRYPTION_KEY to your environment variables.\n' +
      '    Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  const row = await SettingsModel.findOne({ key: 'encryption_key' });
  if (row) {
    cachedKey = parseHexKey(row.value, 'db');
    return;
  }

  cachedKey = crypto.randomBytes(KEY_BYTES);
  await SettingsModel.create({ key: 'encryption_key', value: cachedKey.toString('hex') });
  console.log('\x1b[33m⚠️  No encryption key found. Generated a new one and stored in MongoDB.\x1b[0m');
}

function getEncryptionKey() {
  if (!cachedKey) {
    throw new Error('Encryption key not initialized. Call initEncryptionKey() first.');
  }
  return cachedKey;
}

function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

function decrypt(encrypted, iv, authTag) {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function maskKey(key) {
  if (key.length <= 8) return '****' + key.slice(-4);
  return key.slice(0, 4) + '...' + key.slice(-4);
}

module.exports = {
  initEncryptionKey,
  encrypt,
  decrypt,
  maskKey
};
