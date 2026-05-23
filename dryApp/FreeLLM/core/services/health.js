const { getProvider } = require('../providers');
const { decrypt } = require('../lib/crypto');

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CONSECUTIVE_FAILURES_TO_DISABLE = 3;
const failureCount = new Map();

async function checkKeyHealth(keyId, ApiKeysModel) {
  const row = await ApiKeysModel.findById(keyId);
  if (!row) return 'error';

  const provider = getProvider(row.platform);
  if (!provider) return 'error';

  try {
    const apiKey = decrypt(row.encryptedKey, row.iv, row.authTag);
    let isValid = false;
    if (provider.validateKey) {
      isValid = await provider.validateKey(apiKey);
    } else {
      isValid = true;
    }

    const status = isValid ? 'healthy' : 'invalid';
    row.status = status;
    row.lastCheckedAt = new Date();
    await row.save();

    if (isValid) {
      failureCount.delete(keyId);
    } else {
      const count = (failureCount.get(keyId) || 0) + 1;
      failureCount.set(keyId, count);

      if (count >= CONSECUTIVE_FAILURES_TO_DISABLE) {
        row.enabled = false;
        await row.save();
        console.log('[Health] Auto-disabled key ' + keyId + ' after ' + count + ' consecutive failures');
      }
    }

    return status;
  } catch (err) {
    console.error('[Health] Key ' + keyId + ' transport error:', err.message);
    row.status = 'error';
    row.lastCheckedAt = new Date();
    await row.save();
    return 'error';
  }
}

async function checkAllKeys(ApiKeysModel) {
  const keys = await ApiKeysModel.find({ enabled: true, deletedAt: null }).lean();
  console.log('[Health] Checking ' + keys.length + ' keys...');

  for (const key of keys) {
    await checkKeyHealth(key._id, ApiKeysModel);
  }

  console.log('[Health] Check complete.');
}

let intervalId = null;

function startHealthChecker(ApiKeysModel) {
  if (intervalId) return;
  console.log('[Health] Starting health checker (every ' + (CHECK_INTERVAL_MS / 1000) + 's)');
  intervalId = setInterval(() => {
    checkAllKeys(ApiKeysModel).catch(err => console.error('[Health] Check failed:', err));
  }, CHECK_INTERVAL_MS);
}

function stopHealthChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = {
  checkKeyHealth,
  checkAllKeys,
  startHealthChecker,
  stopHealthChecker
};
