const os = require('os');
const { createHash } = require('crypto');
const emailService = require('../auth/email.service');
const config = require('../../../config/database');

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = [
  'password',
  'pass',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'apikey',
  'x-api-key',
  'email_pass',
  'smtp_password',
  'accessToken',
  'refreshToken',
];

const alertDedupWindowMs = Number(process.env.ALERT_DEDUP_WINDOW_MS || 60000);
const alertMaxStackLines = Number(process.env.ALERT_MAX_STACK_LINES || 20);
const alertMaxValueLength = Number(process.env.ALERT_MAX_VALUE_LENGTH || 1500);
const sentAlertMap = new Map();

const truncate = (value, max = alertMaxValueLength) => {
  const str = String(value ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, max)}... [truncated ${str.length - max} chars]`;
};

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
};

const isSensitiveKey = (key) => {
  const k = String(key || '').toLowerCase();
  return SENSITIVE_KEYS.some((candidate) => k.includes(candidate.toLowerCase()));
};

const sanitizeValue = (value, depth = 0) => {
  if (value == null) return value;
  if (depth > 5) return '[MAX_DEPTH_REACHED]';

  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return extractErrorDetails(value);

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    const entries = Object.entries(value).slice(0, 60);
    for (const [key, val] of entries) {
      if (isSensitiveKey(key)) out[key] = REDACTED;
      else out[key] = sanitizeValue(val, depth + 1);
    }
    return out;
  }

  return truncate(value);
};

const buildFingerprint = (parts) => {
  const raw = parts.filter(Boolean).map(String).join('|');
  return createHash('sha1').update(raw).digest('hex').slice(0, 16);
};

const extractErrorDetails = (rawError) => {
  if (!rawError) return null;
  if (typeof rawError === 'string') {
    return {
      name: 'Error',
      message: truncate(rawError),
      fingerprint: buildFingerprint([rawError]),
    };
  }

  if (typeof rawError !== 'object') {
    return {
      name: 'Error',
      message: truncate(String(rawError)),
      fingerprint: buildFingerprint([String(rawError)]),
    };
  }

  const message =
    rawError.message ||
    rawError.error ||
    rawError.response?.data?.message ||
    rawError.response?.data?.error ||
    String(rawError);

  const stack = typeof rawError.stack === 'string'
    ? rawError.stack.split('\n').slice(0, alertMaxStackLines).join('\n')
    : undefined;

  const responseData = rawError.response?.data !== undefined
    ? sanitizeValue(rawError.response.data)
    : undefined;

  const details = {
    name: rawError.name || 'Error',
    message: truncate(message),
    code: rawError.code || rawError.errno || rawError.type,
    errno: rawError.errno,
    syscall: rawError.syscall,
    status: rawError.status || rawError.statusCode || rawError.httpStatus,
    hostname: rawError.hostname,
    address: rawError.address,
    port: rawError.port,
    stack,
    responseData,
  };

  if (rawError.cause) {
    details.cause = extractErrorDetails(rawError.cause);
  }

  const stackHead = stack ? stack.split('\n')[0] : '';
  details.fingerprint = buildFingerprint([details.name, details.code, details.message, stackHead]);
  return sanitizeValue(details);
};

const inferProbableCause = (errorDetails) => {
  const code = String(errorDetails?.code || '').toUpperCase();
  const message = String(errorDetails?.message || '').toLowerCase();
  const status = Number(errorDetails?.status || 0);

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'Resolution DNS impossible (hote introuvable).';
  }
  if (code === 'ECONNREFUSED') {
    return 'Connexion refusee par le service distant (service arrete ou port ferme).';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || code.includes('TIMEOUT')) {
    return 'Timeout reseau (latence elevee ou service distant non repondant).';
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
    return 'Reseau injoignable depuis le serveur.';
  }
  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return 'Connexion interrompue brutalement par le service distant.';
  }
  if (status === 401 || status === 403) {
    return 'Authentification ou autorisation invalide (cle API/token/permissions).';
  }
  if (status === 429) {
    return 'Limite de debit atteinte chez le fournisseur externe.';
  }
  if (status >= 500 && status <= 599) {
    return 'Erreur interne du service externe contacte.';
  }
  if (message.includes('fetch failed')) {
    return 'Echec fetch: verifier connectivite sortante, DNS et pare-feu.';
  }
  if (message.includes('mongo') && (message.includes('serverselection') || message.includes('connect'))) {
    return 'Connexion MongoDB impossible ou instable.';
  }
  if (message.includes('jwt_secret')) {
    return 'Configuration manquante ou invalide (JWT_SECRET).';
  }
  return 'Cause technique a verifier dans les details de la stack et du contexte.';
};

const normalizeAlertPayload = (payload = {}) => {
  const normalized = {
    ...payload,
    timestamp: payload.timestamp || new Date().toISOString(),
    server: payload.server || os.hostname(),
    environment: payload.environment || config.NODE_ENV || process.env.NODE_ENV || 'unknown',
    pid: payload.pid || process.pid,
  };

  const extracted = payload.errorDetails || extractErrorDetails(payload.error);
  if (extracted) {
    normalized.errorDetails = extracted;
    normalized.error = extracted.message;
    if (!normalized.causeProbable) {
      normalized.causeProbable = inferProbableCause(extracted);
    }
    normalized.fingerprint = normalized.fingerprint || extracted.fingerprint;
  }

  normalized.request = sanitizeValue(payload.request);
  normalized.details = sanitizeValue(payload.details);
  normalized.summaryLines = Array.isArray(payload.summaryLines)
    ? payload.summaryLines.slice(0, 20).map((line) => truncate(line, 300))
    : payload.summaryLines;

  return sanitizeValue(normalized);
};

const dedupAlert = (payload) => {
  if (!alertDedupWindowMs || alertDedupWindowMs <= 0) return { deduped: false };
  const event = payload.event || 'ALERT';
  const key = payload.dedupKey || `${event}:${payload.fingerprint || payload.error || payload.status || 'generic'}`;
  const now = Date.now();
  const lastAt = sentAlertMap.get(key);

  if (lastAt && now - lastAt < alertDedupWindowMs) {
    return { deduped: true, key, windowMs: alertDedupWindowMs, elapsedMs: now - lastAt };
  }

  sentAlertMap.set(key, now);
  if (sentAlertMap.size > 1000) {
    const threshold = now - (alertDedupWindowMs * 2);
    for (const [cacheKey, ts] of sentAlertMap.entries()) {
      if (ts < threshold) sentAlertMap.delete(cacheKey);
    }
  }

  return { deduped: false, key, windowMs: alertDedupWindowMs };
};

const postJson = async (url, payload, headers = {}) => {
  if (!url || typeof fetch !== 'function') {
    return { ok: false, skipped: true, error: 'Webhook URL absente ou fetch indisponible' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    const raw = await res.text().catch(() => '');
    const parsed = safeJsonParse(raw);
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      response: parsed || truncate(raw, 600),
      error: res.ok ? null : `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: extractErrorDetails(err)?.message || 'Erreur reseau',
      errorDetails: extractErrorDetails(err),
    };
  }
};

const eventMeta = (event) => {
  if (event === 'DRY_HEALTH_RECOVERED') {
    return { title: 'Serveur retabli', tone: 'ok', color: '#1b5e20', bg: '#e8f5e9', label: 'OK' };
  }
  if (event === 'DRY_API_EXCEPTION') {
    return { title: 'Erreur API non geree', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'CRITIQUE' };
  }
  if (event === 'DRY_UNHANDLED_REJECTION') {
    return { title: 'Promesse rejetee non geree', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'CRITIQUE' };
  }
  if (event === 'DRY_UNCAUGHT_EXCEPTION') {
    return { title: 'Exception fatale non interceptee', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'CRITIQUE' };
  }
  if (event === 'DRY_DAILY_SUMMARY' || event === 'DRY_LOGS_SUMMARY') {
    return { title: 'Resume monitoring', tone: 'summary', color: '#0d47a1', bg: '#e3f2fd', label: 'RESUME' };
  }
  if (event === 'DRY_HEALTH_NOT_READY') {
    return { title: 'Serveur non pret', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'ALERTE' };
  }
  if (event === 'DRY_HEALTH_ERROR') {
    return { title: 'Erreur de monitoring', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'ALERTE' };
  }
  return { title: 'Alerte DRY', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'ALERTE' };
};

const formatDateTime = (value) => {
  try {
    const d = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(d);
  } catch (e) {
    return value || new Date().toISOString();
  }
};

const buildText = (payload) => {
  const meta = eventMeta(payload.event);
  const parts = [
    `${meta.title}`,
    `Event: ${payload.event || 'ALERT'}`,
    `Status: ${payload.status || 'UNKNOWN'}`,
    `HTTP: ${payload.http || 'N/A'}`,
    `URL: ${payload.url || 'N/A'}`,
    `Tenant: ${payload.tenant || 'N/A'}`,
    `RequestId: ${payload.requestId || payload.request?.id || 'N/A'}`,
    `Downtime(s): ${payload.downtimeSeconds ?? 'N/A'}`,
    `Time: ${payload.timestamp || new Date().toISOString()}`,
  ];
  if (payload.error) parts.push(`Error: ${payload.error}`);
  if (payload.causeProbable) parts.push(`Cause: ${payload.causeProbable}`);
  if (payload.fingerprint) parts.push(`Fingerprint: ${payload.fingerprint}`);
  return parts.join(' | ');
};

const buildEmailHtml = (payload) => {
  const meta = eventMeta(payload.event);
  const rows = [
    { label: 'Evenement', value: payload.event || 'ALERT' },
    { label: 'Statut', value: payload.status || 'UNKNOWN' },
    { label: 'HTTP', value: payload.http || 'N/A' },
    { label: 'URL', value: payload.url || 'N/A' },
    { label: 'Serveur', value: payload.server || 'N/A' },
    { label: 'Environnement', value: payload.environment || 'N/A' },
    { label: 'PID', value: payload.pid || 'N/A' },
    { label: 'Tenant', value: payload.tenant || 'N/A' },
    { label: 'RequestId', value: payload.requestId || payload.request?.id || 'N/A' },
    { label: 'Downtime (s)', value: payload.downtimeSeconds ?? 'N/A' },
    { label: 'Downtime (humain)', value: payload.downtimeHuman || 'N/A' },
    { label: 'Debut panne', value: payload.downtimeStart || 'N/A' },
    { label: 'Fin panne', value: payload.downtimeEnd || 'N/A' },
    { label: 'Date / heure', value: formatDateTime(payload.timestamp) },
  ];
  if (payload.error) rows.push({ label: 'Erreur', value: payload.error });
  if (payload.fingerprint) rows.push({ label: 'Fingerprint', value: payload.fingerprint });
  if (payload.causeProbable) rows.push({ label: 'Cause probable', value: payload.causeProbable });
  if (payload.summaryWindow) rows.push({ label: 'Fenetre resume', value: payload.summaryWindow });
  if (payload.summaryCount !== undefined) rows.push({ label: 'Nombre d incidents', value: payload.summaryCount });
  if (payload.summaryLines && payload.summaryLines.length) {
    rows.push({ label: 'Details', value: payload.summaryLines.join(' | ') });
  }

  const rowsHtml = rows
    .map((r) => `<tr><td style="padding:6px 10px;font-weight:600;">${r.label}</td><td style="padding:6px 10px;">${r.value}</td></tr>`)
    .join('');

  const requestBlock = payload.request
    ? `<h3 style="margin:16px 0 6px 0;">Contexte requete</h3><pre style="background:#fafafa;border:1px solid #eee;padding:10px;white-space:pre-wrap;word-break:break-word;">${truncate(JSON.stringify(payload.request, null, 2), 5000)}</pre>`
    : '';

  const errorDetailsBlock = payload.errorDetails
    ? `<h3 style="margin:16px 0 6px 0;">Details techniques</h3><pre style="background:#111;color:#f6f6f6;padding:10px;white-space:pre-wrap;word-break:break-word;">${truncate(JSON.stringify(payload.errorDetails, null, 2), 7000)}</pre>`
    : '';

  const deliveryBlock = payload.delivery
    ? `<h3 style="margin:16px 0 6px 0;">Statut des canaux</h3><pre style="background:#fafafa;border:1px solid #eee;padding:10px;white-space:pre-wrap;word-break:break-word;">${truncate(JSON.stringify(payload.delivery, null, 2), 4000)}</pre>`
    : '';

  const intro =
    meta.tone === 'ok'
      ? 'Le serveur est a nouveau disponible. Tout est revenu a la normale.'
      : meta.tone === 'summary'
        ? 'Voici un resume des incidents detectes par le monitoring DRY.'
        : 'Une anomalie a ete detectee par le monitoring DRY.';

  const actions =
    meta.tone === 'alert'
      ? `
  <p style="margin:12px 0 0 0;">
    Actions recommandees:
    <br/>1) Verifie que le serveur repond: <code>${payload.url || ''}</code>
    <br/>2) Verifie les logs du serveur (Render / PM2)
    <br/>3) Si c'est une erreur reseau, verifie DNS et connectivite
  </p>`
      : '';

  return `
<div style="font-family: Arial, sans-serif; color: #222;">
  <div style="padding:10px 14px; background:${meta.bg}; border-left:6px solid ${meta.color}; margin-bottom:12px;">
    <div style="font-size:12px; letter-spacing:0.5px; color:${meta.color}; font-weight:700;">${meta.label}</div>
    <h2 style="margin:4px 0 0 0; color:${meta.color};">${meta.title}</h2>
  </div>
  <p style="margin:0 0 12px 0;">${intro}</p>
  <table style="border-collapse: collapse; border: 1px solid #ddd; width:100%; max-width:720px;">
    ${rowsHtml}
  </table>
  ${requestBlock}
  ${errorDetailsBlock}
  ${deliveryBlock}
  ${actions}
</div>`;
};

const sendAlert = async (payload) => {
  const normalized = normalizeAlertPayload(payload);
  const dedup = dedupAlert(normalized);
  if (dedup.deduped) {
    return {
      skipped: true,
      reason: 'deduplicated',
      dedup,
    };
  }

  const text = buildText(normalized);

  const genericWebhook = config.ALERT_WEBHOOK_URL || '';
  const slackWebhook = config.SLACK_WEBHOOK_URL || '';
  const discordWebhook = config.DISCORD_WEBHOOK_URL || '';
  const emailTo = config.ALERT_EMAIL_TO || '';

  const genericResult = genericWebhook ? await postJson(genericWebhook, normalized) : { ok: null, skipped: true };
  const slackResult = slackWebhook ? await postJson(slackWebhook, { text }) : { ok: null, skipped: true };
  const discordResult = discordWebhook ? await postJson(discordWebhook, { content: text }) : { ok: null, skipped: true };

  const delivery = {
    webhook: {
      generic: genericResult,
      slack: slackResult,
      discord: discordResult,
    },
    email: { ok: null, skipped: !emailTo },
  };

  let emailErrorDetails = null;
  if (emailTo) {
    try {
      const meta = eventMeta(normalized.event);
      const subject = `[DRY ${meta.label}] ${meta.title} - ${normalized.event || 'ALERT'}`;
      const html = buildEmailHtml({ ...normalized, delivery });
      await emailService.sendGenericEmail({ email: emailTo, subject, html, throwOnError: true });
      delivery.email = { ok: true, skipped: false };
    } catch (err) {
      emailErrorDetails = extractErrorDetails(err);
      delivery.email = {
        ok: false,
        skipped: false,
        error: emailErrorDetails?.message || 'Erreur envoi email',
        errorDetails: emailErrorDetails,
      };
    }
  }

  return {
    skipped: false,
    dedup,
    delivery,
    webhook: {
      generic: !!genericResult?.ok,
      slack: !!slackResult?.ok,
      discord: !!discordResult?.ok,
    },
    email: delivery.email.ok,
    error: emailErrorDetails?.message || null,
  };
};

module.exports = {
  sendAlert,
  extractErrorDetails,
  inferProbableCause,
  sanitizeValue,
};
