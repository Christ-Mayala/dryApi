require('dotenv').config({ quiet: true });

const strict = String(process.env.TEST_STRICT || '').toLowerCase() === 'true';

const ensureServer = async (baseUrl) => {
  try {
    const res = await fetch(baseUrl + '/health/ready');
    if (!res.ok) {
      if (strict) throw new Error('Server not ready');
      return false;
    }
    const json = await res.json().catch(() => null);
    if (!json || json.status !== 'READY') {
      if (strict) throw new Error('Server not ready');
      return false;
    }
    return true;
  } catch (e) {
    if (strict) throw e;
    return false;
  }
};

const safeJson = async (res) => {
  const ct = res.headers?.get ? (res.headers.get('content-type') || '') : '';
  if (!ct.includes('application/json')) {
    return null;
  }
  return res.json().catch(() => null);
};

const loginAdmin = async (baseUrl, email, password) => {
  try {
    const res = await fetch(baseUrl + '/api/v1/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await safeJson(res);
    return json?.data?.token || null;
  } catch (e) {
    return null;
  }
};

module.exports = { ensureServer, loginAdmin };
