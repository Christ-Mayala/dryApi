const AuditLogSchema = require('../../models/audit/AuditLog.model');

const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'otp',
  'code',
  'resetCode',
  'smtp_password',
  'api_key',
  'api_secret',
]);

const sanitize = (value, depth = 0) => {
  if (depth > 3) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 500 ? value.slice(0, 500) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(String(k))) out[k] = '[REDACTED]';
      else out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
};

const auditLogger = (actionName) => async (req, res, next) => {
  try {
    if (!req.user) return next();

    const userAgent = req.headers['user-agent'] || 'unknown';
    const origin = req.headers.origin || req.headers.referer || 'unknown';

    // On prépare un listener sur "finish" pour connaître le status HTTP réel.
    const start = Date.now();
    const originalEnd = res.end;

    res.end = function chunkedEnd(...args) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;

      const mapAction = () => {
        const label = String(actionName || '').toLowerCase();
        if (label.includes('login')) return 'login';
        if (label.includes('logout')) return 'logout';
        if (label.includes('create') || label.includes('start')) return 'create';
        if (label.includes('update')) return 'update';
        if (label.includes('delete')) return 'delete';
        if (req.method === 'GET') return 'view';
        if (req.method === 'POST') return 'create';
        if (req.method === 'PUT' || req.method === 'PATCH') return 'update';
        if (req.method === 'DELETE') return 'delete';
        return 'view';
      };

      const AuditLog = req.getModel ? req.getModel('AuditLog', AuditLogSchema) : null;
      if (AuditLog && typeof AuditLog.create === 'function') {
        AuditLog.create({
          action: mapAction(),
          resourceType: req.baseUrl || req.path || 'unknown',
          resourceId: req.params?.id || undefined,
          userId: req.user?._id,
          userEmail: req.user?.email,
          tenantId: req.appName || req.params?.tenant || 'unknown',
          ipAddress: req.ip,
          userAgent,
          details: {
            body: sanitize(req.body),
            query: sanitize(req.query),
            statusCode,
            durationMs: duration,
          },
          status: statusCode >= 400 ? 'failure' : 'success',
        }).catch((err) => {
          console.error('Audit Log Error:', err.message);
        });
      }

      // On appelle ensuite le end original
      return originalEnd.apply(this, args);
    };
  } catch (err) {
    console.error('Audit Log Setup Error:', err.message);
  }

  next();
};

module.exports = auditLogger;
