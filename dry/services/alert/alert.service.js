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
const alertMaxPayloadLength = Number(process.env.ALERT_MAX_PAYLOAD_LENGTH || config.ALERT_MAX_PAYLOAD_LENGTH || 1500);
const sentAlertMap = new Map();

// Seuil de severite pour les heures calmes
const quietStart = String(config.ALERT_QUIET_START || '22:00');
const quietEnd = String(config.ALERT_QUIET_END || '07:00');
const quietTimezone = String(config.ALERT_QUIET_TIMEZONE || 'Africa/Brazzaville');

// Telegram / WhatsApp config
const telegramBotToken = String(config.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '');
const telegramChatId = String(config.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '');
const callMeBotApiKey = String(config.CALLMEBOT_API_KEY || process.env.CALLMEBOT_API_KEY || '');
const callMeBotPhone = String(config.CALLMEBOT_PHONE || process.env.CALLMEBOT_PHONE || '');

// Log de configuration au démarrage
console.log(`[AlertService] Telegram configure: ${telegramBotToken && telegramChatId ? 'OUI (bot=${telegramBotToken.slice(0, 10)}..., chat=${telegramChatId})' : 'NON'}`);
console.log(`[AlertService] WhatsApp configure: ${callMeBotApiKey && callMeBotPhone ? 'OUI (phone=' + callMeBotPhone + ')' : 'NON'}`);
console.log(`[AlertService] Email configure: ${config.ALERT_EMAIL_TO ? 'OUI (' + config.ALERT_EMAIL_TO + ')' : 'NON'}`);
const getMaintenanceMode = async () => {
  try {
    const redis = require('../cache/redis.service');
    const val = await redis.get('alerts:maintenanceMode');
    return val === '1' || val === 'true';
  } catch {
    return String(config.ALERT_MAINTENANCE_MODE || 'false').toLowerCase() === 'true';
  }
};

const truncate = (value, max = alertMaxValueLength) => {
  const str = String(value ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, max)}... [truncated ${str.length - max} chars]`;
};

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isSensitiveKey = (key) => {
  const k = String(key || '').toLowerCase();
  return SENSITIVE_KEYS.some((candidate) => k.includes(candidate.toLowerCase()));
};

const sanitizeValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
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

const extractCodeSnippet = (sourceLine) => {
  if (!sourceLine || sourceLine === 'N/A') return null;

  try {
    const match = sourceLine.match(/(.*?):(\d+):(\d+)/);
    if (!match) return null;

    let filePath = match[1];
    const lineNum = parseInt(match[2], 10);
    if (isNaN(lineNum)) return null;

    if (!require('path').isAbsolute(filePath)) {
      filePath = require('path').resolve(process.cwd(), filePath);
    }

    if (!filePath.startsWith(process.cwd()) && !filePath.includes('dry')) {
       return null;
    }

    const fs = require('fs');
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const start = Math.max(0, lineNum - 4);
    const end = Math.min(lines.length, lineNum + 3);
    
    const snippet = lines.slice(start, end).map((line, idx) => {
      const currentLineNum = start + idx + 1;
      const isErrorLine = currentLineNum === lineNum;
      const prefix = isErrorLine ? '>>> ' : '    ';
      return `${String(currentLineNum).padStart(4)} | ${prefix}${line.replace(/\r/g, '')}`;
    }).join('\n');

    return {
      file: require('path').basename(filePath),
      path: filePath.replace(process.cwd(), '.'),
      line: lineNum,
      code: snippet
    };
  } catch {
    return null;
  }
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

  let source = 'N/A';
  if (stack) {
    const lines = stack.split('\n');
    const firstRelevant = lines.find(l => l.includes('/') || l.includes('\\')) || lines[1];
    if (firstRelevant) {
      const match = firstRelevant.match(/([a-zA-Z0-9._-]+\.[a-z0-9]+:\d+:\d+)/);
      source = match ? match[1] : firstRelevant.trim().replace(/^at\s+/, '');
    }
  }

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
    source,
    stack,
    responseData,
  };

  const snippet = extractCodeSnippet(source);
  if (snippet) {
    details.snippet = snippet;
  }

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
  const name = String(errorDetails?.name || '');

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'Resolution DNS impossible. Verifiez l\'URL du service externe ou la connexion internet du serveur.';
  }
  if (code === 'ECONNREFUSED') {
    return 'Connexion refusee par le service distant. Le service est probablement arrete ou le port est bloque.';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || code.includes('TIMEOUT')) {
    return 'La requete a mis trop de temps a repondre (Timeout). Reseau instable ou service distant sature.';
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
    return 'Reseau ou hote injoignable. Probleme de routage ou de pare-feu sur le serveur.';
  }
  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return 'La connexion a ete interrompue brutalement par le destinataire (Crash ou restart du service distant).';
  }
  if (status === 401 || status === 403) {
    return 'Authentification ou permissions invalides. Verifiez les cles API ou le token de session.';
  }
  if (status === 429) {
    return 'Trop de requetes (Rate limit). Le fournisseur externe vous a bloque temporairement.';
  }
  if (status >= 500 && status <= 599) {
    return 'Erreur interne chez le fournisseur externe. Le probleme vient de chez eux.';
  }
  if (name === 'ValidationError') {
    return 'Donnees envoyees non conformes au schema de la base de donnees (Erreur de validation).';
  }
  if (name === 'CastError') {
    return 'Format d\'identifiant (ID) incorrect pour la base de donnees.';
  }
  if (message.includes('fetch failed')) {
    return 'Echec de la requete sortante (fetch). Verifiez la configuration proxy et DNS.';
  }
  if (message.includes('mongo') && (message.includes('serverselection') || message.includes('connect'))) {
    return 'Impossible de se connecter a la base de donnees MongoDB. Verifiez si l\'instance est en ligne.';
  }
  if (message.includes('jwt_secret')) {
    return 'Secret JWT manquant ou invalide dans la configuration (.env).';
  }
  if (message.includes('cors')) {
    return 'Requete bloquee par la politique CORS (Origine non autorisee).';
  }
  return 'Cause technique a determiner. Consultez les details de la stack trace pour plus de precision.';
};

const normalizeAlertPayload = (payload = {}) => {
  const normalized = {
    ...payload,
    timestamp: payload.timestamp || new Date().toISOString(),
    server: payload.server || os.hostname(),
    environment: payload.environment || config.NODE_ENV || process.env.NODE_ENV || 'unknown',
    pid: payload.pid || process.pid,
  };

  try {
    const mongoose = require('mongoose');
    normalized.health = {
      database: mongoose.connection.readyState === 1 ? 'UP' : 'DOWN',
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      },
      uptime: Math.round(process.uptime())
    };
  } catch {}

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

const eventMeta = (event, severity = 'warning') => {
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

  if (severity === 'critical') {
    return { title: 'Alerte Critique DRY', tone: 'alert', color: '#b71c1c', bg: '#ffebee', label: 'CRITIQUE' };
  }
  if (severity === 'info') {
    return { title: 'Information DRY', tone: 'info', color: '#0d47a1', bg: '#e3f2fd', label: 'INFO' };
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
  } catch {
    return value || new Date().toISOString();
  }
};

const buildText = (payload) => {
  const meta = eventMeta(payload.event, payload.severity);
  const parts = [
    `${meta.title}`,
    `Severity: ${payload.severity || 'warning'}`,
    `Event: ${payload.event || 'ALERT'}`,
    `Status: ${payload.status || 'UNKNOWN'}`,
  ];

  const http = payload.http || payload.url;
  if (http) parts.push(`HTTP: ${http}`);

  const tenant = payload.tenant || payload.details?.tenant;
  if (tenant) parts.push(`Tenant: ${tenant}`);

  const requestId = payload.requestId || payload.request?.id;
  if (requestId) parts.push(`RequestId: ${requestId}`);

  if (payload.downtimeSeconds !== undefined && payload.downtimeSeconds !== null) {
    parts.push(`Downtime(s): ${payload.downtimeSeconds}`);
  }

  const errorMessage = payload.error || payload.message || payload.details?.message;
  if (errorMessage) parts.push(`Error: ${errorMessage}`);

  const cause = payload.causeProbable || payload.details?.issue?.message;
  if (cause) parts.push(`Cause: ${cause}`);

  if (payload.health?.database) parts.push(`DB: ${payload.health.database}`);
  if (payload.health?.memory?.rss) parts.push(`Mem: ${payload.health.memory.rss}`);

  parts.push(`Time: ${payload.timestamp || new Date().toISOString()}`);
  return parts.join(' | ');
};

const buildEmailHtml = (payload) => {
  const meta = eventMeta(payload.event, payload.severity);
  const err = payload.errorDetails || {};
  
  const mainRows = [
    { label: '?? Evenement', value: payload.event || 'ALERT' },
    { label: '?? Severite', value: payload.severity || 'warning' },
    { label: '?? URL / Route', value: `<code>${payload.http || payload.url || 'N/A'}</code>` },
    { label: '?? Tenant / Client', value: payload.tenant || 'N/A' },
    { label: '?? Date & Heure', value: formatDateTime(payload.timestamp) },
  ];

  if (payload.health) {
    mainRows.push({ 
      label: '?? Sante Systeme', 
      value: `DB: <b style="color:${payload.health.database === 'UP' ? '#2e7d32' : '#d32f2f'};">${payload.health.database}</b> | Mem: ${payload.health.memory.rss} | Up: ${payload.health.uptime}s` 
    });
  }

  const techRows = [
    { label: '?? Source Precis', value: `<b style="color:#d32f2f;">${err.source || 'Inconnue'}</b>` },
    { label: '? Erreur', value: `<code>${err.name || 'Error'}: ${err.message || payload.error || 'N/A'}</code>` },
    { label: '?? Cause Probable', value: `<i style="color:#1976d2;">${payload.causeProbable || 'N/A'}</i>` },
    { label: '?? Request ID', value: `<code>${payload.requestId || 'N/A'}</code>` },
    { label: '?? Trace ID', value: `<code>${payload.traceId || 'N/A'}</code>` },
  ];

  const envRows = [
    { label: '??? Serveur', value: payload.server || 'N/A' },
    { label: '?? Environnement', value: payload.environment || 'N/A' },
  ];

  const renderRows = (rows) => rows
    .map((r) => `<tr><td style="padding:10px; border-bottom:1px solid #eee; width:160px; color:#666; font-size:13px;">${r.label}</td><td style="padding:10px; border-bottom:1px solid #eee; font-size:14px; word-break:break-all;">${r.value}</td></tr>`)
    .join('');

  const requestBlock = payload.request
    ? `
    <div style="margin-top:25px;">
      <h3 style="margin:0 0 10px 0; font-size:16px; color:#444; border-bottom:2px solid #ddd; padding-bottom:5px;">?? Contexte de la Requete</h3>
      <div style="background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; padding:12px; font-family:monospace; font-size:12px; overflow-x:auto;">
        <pre style="margin:0; white-space:pre-wrap;">${truncate(JSON.stringify(payload.request, null, 2), 5000)}</pre>
      </div>
    </div>`
    : '';

  const stackBlock = err.stack
    ? `
    <div style="margin-top:25px;">
      <h3 style="margin:0 0 10px 0; font-size:16px; color:#444; border-bottom:2px solid #ddd; padding-bottom:5px;">?? Stack Trace</h3>
      <div style="background:#212529; color:#f8f9fa; border-radius:4px; padding:12px; font-family:monospace; font-size:11px; overflow-x:auto; line-height:1.5;">
        <pre style="margin:0; white-space:pre-wrap;">${truncate(err.stack, 7000)}</pre>
      </div>
    </div>`
    : '';

  const codeSnippetBlock = err.snippet
    ? `
    <div style="margin-top:25px;">
      <h3 style="margin:0 0 10px 0; font-size:16px; color:#444; border-bottom:2px solid #ddd; padding-bottom:5px;">?? Extrait du Code (Précision Chirurgicale)</h3>
      <div style="margin-bottom:5px; font-size:12px; color:#666;">Fichier: <code>${err.snippet.path}</code> (Ligne ${err.snippet.line})</div>
      <div style="background:#1e1e1e; color:#dcdcaa; border-radius:4px; padding:12px; font-family:'Consolas', 'Monaco', monospace; font-size:12px; overflow-x:auto; border-left:4px solid #d32f2f;">
        <pre style="margin:0; white-space:pre-wrap;">${err.snippet.code}</pre>
      </div>
    </div>`
    : '';

  const actions = meta.tone === 'alert'
    ? `
    <div style="margin-top:25px; padding:15px; background:#fff3e0; border-left:4px solid #ff9800; border-radius:4px;">
      <h4 style="margin:0 0 8px 0; color:#e65100;">??? Actions Recommandees</h4>
      <ul style="margin:0; padding-left:20px; font-size:14px; color:#5d4037;">
        <li>Verifier si le service est accessible via <code>${payload.url || 'le lien direct'}</code></li>
        <li>Consulter les logs de production (Render/PM2) pour plus de contexte</li>
        <li>Verifier l'etat de la base de donnees et des services tiers connectes</li>
        <li>Le serveur tentera de redemarrer automatiquement s'il s'agit d'un crash fatal ("Autonome").</li>
      </ul>
    </div>`
    : '';

  return `
<div style="max-width:800px; margin:0 auto; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#333; line-height:1.6;">
  <div style="background:${meta.bg}; padding:25px; border-radius:8px 8px 0 0; border-left:8px solid ${meta.color};">
    <div style="text-transform:uppercase; font-size:12px; font-weight:bold; color:${meta.color}; margin-bottom:5px; letter-spacing:1px;">${meta.label}</div>
    <h1 style="margin:0; font-size:24px; color:${meta.color};">${meta.title}</h1>
  </div>
  
  <div style="padding:25px; border:1px solid #ddd; border-top:none; border-radius:0 0 8px 8px; background:#fff;">
    <p style="margin-top:0; font-size:15px;">Une anomalie a ete detectee par le monitoring <b>DRY API</b>.</p>
    
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      ${renderRows(mainRows)}
      ${renderRows(techRows)}
      ${renderRows(envRows)}
    </table>

    ${codeSnippetBlock}
    ${requestBlock}
    ${stackBlock}
    ${actions}
    
    <div style="margin-top:30px; text-align:center; color:#999; font-size:11px; border-top:1px solid #eee; padding-top:15px;">
      Systeme de Monitoring DRY API • Genere automatiquement le ${formatDateTime(new Date().toISOString())}
    </div>
  </div>
</div>`;
};

const isQuietHours = () => {
  try {
    const now = new Date();
    const options = { timeZone: quietTimezone, hour: '2-digit', minute: '2-digit', hour12: false };
    const currentTime = now.toLocaleTimeString('fr-FR', options).slice(0, 5);
    
    let start = quietStart;
    let end = quietEnd;
    
    if (start.includes(':')) start = start.padStart(5, '0');
    if (end.includes(':')) end = end.padStart(5, '0');
    
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
  } catch {
    return false;
  }
};

const shouldSendBySeverity = (severity) => {
  const sev = String(severity || config.ALERT_DEFAULT_SEVERITY || 'warning').toLowerCase();
  if (isQuietHours()) {
    return sev === 'critical' || sev === 'info';
  }
  return true;
};

const getSeverityChannels = async (severity) => {
  const sev = String(severity || config.ALERT_DEFAULT_SEVERITY || 'warning').toLowerCase();
  
  const isMaintenanceMode = await getMaintenanceMode();
  if (isMaintenanceMode && sev !== 'critical') {
    return { webhook: false, slack: false, discord: false, email: false, telegram: false, whatsapp: false, logOnly: true };
  }
  
  switch (sev) {
    case 'critical':
      return { webhook: true, slack: true, discord: true, email: true, telegram: true, whatsapp: true, logOnly: false };
    case 'warning':
      return { webhook: true, slack: false, discord: false, email: true, telegram: true, whatsapp: false, logOnly: false };
    case 'info':
    default:
      return { webhook: true, slack: false, discord: false, email: true, telegram: false, whatsapp: false, logOnly: false };
  }
};

const storeAlert = async (normalized, severity) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return null;
    
    const AlertSchema = require('../../models/alert/Alert.schema');
    let Alert = mongoose.connection.models.Alert;
    if (!Alert) {
      Alert = mongoose.connection.model('Alert', AlertSchema);
    }
    
    const alertDoc = new Alert({
      severity: String(severity || config.ALERT_DEFAULT_SEVERITY || 'warning').toLowerCase(),
      event: normalized.event || 'ALERT',
      message: normalized.error || normalized.message || 'Alerte systeme',
      traceId: normalized.traceId || null,
      userId: normalized.userId || null,
      tenantId: normalized.tenant || null,
      requestId: normalized.requestId || null,
      context: {
        details: normalized.details,
        request: normalized.request,
        health: normalized.health,
        errorDetails: normalized.errorDetails,
      },
      channelsSent: {
        webhook: { generic: false, slack: false, discord: false },
        email: false,
      },
      timestamp: new Date(normalized.timestamp || Date.now()),
    });
    
    await alertDoc.save();
    return alertDoc;
  } catch (storeError) {
    console.warn('[AlertStore] Echec stockage alerte:', storeError.message);
    return null;
  }
};

const sendAlert = async (payload, severity = 'warning') => {
  const sev = String(severity || config.ALERT_DEFAULT_SEVERITY || 'warning').toLowerCase();
  const normalized = normalizeAlertPayload({ ...payload, severity: sev });
  
  if (!shouldSendBySeverity(sev)) {
    const reason = isQuietHours() ? 'quiet_hours' : 'maintenance_mode';
    console.log(`[Alert] ${reason} - alerte ${sev} ignoree: ${normalized.event}`);
    await storeAlert(normalized, sev);
    return { skipped: true, reason, severity: sev };
  }
  
  const dedup = dedupAlert(normalized);
  if (dedup.deduped) {
    return {
      skipped: true,
      reason: 'deduplicated',
      dedup,
    };
  }

  const text = buildText(normalized);
  const channels = await getSeverityChannels(sev);
  console.log(`[AlertService] Severity=${sev}, channels=${JSON.stringify(channels)}`);

  const genericWebhook = config.ALERT_WEBHOOK_URL || '';
  const slackWebhook = config.SLACK_WEBHOOK_URL || '';
  const discordWebhook = config.DISCORD_WEBHOOK_URL || '';
  const emailTo = config.ALERT_EMAIL_TO || '';

  const genericResult = (channels.webhook && genericWebhook) ? await postJson(genericWebhook, normalized) : { ok: null, skipped: true };
  const slackResult = (channels.slack && slackWebhook) ? await postJson(slackWebhook, { text }) : { ok: null, skipped: true };
  const discordResult = (channels.discord && discordWebhook) ? await postJson(discordWebhook, { content: text }) : { ok: null, skipped: true };

  const delivery = {
    webhook: {
      generic: genericResult,
      slack: slackResult,
      discord: discordResult,
    },
    email: { ok: null, skipped: !channels.email || !emailTo },
    telegram: { ok: null, skipped: !channels.telegram || !telegramBotToken || !telegramChatId },
    whatsapp: { ok: null, skipped: !channels.whatsapp || !callMeBotApiKey || !callMeBotPhone },
  };

  let emailErrorDetails = null;
  if (channels.email && emailTo) {
    try {
      const meta = eventMeta(normalized.event, sev);
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

  let telegramErrorDetails = null;
  if (channels.telegram && telegramBotToken && telegramChatId) {
    console.log(`[AlertService] Tentative envoi Telegram: severity=${sev}, event=${normalized.event}, chat=${telegramChatId}`);
    try {
      const meta = eventMeta(normalized.event, sev);
      
      const message = [
        `${meta.title}`,
        `Severity: ${sev}`,
        `Event: ${normalized.event || 'ALERT'}`,
        `Status: ${normalized.status || 'UNKNOWN'}`,
      ];

      const http = normalized.http || normalized.url;
      if (http) message.push(`HTTP: ${http}`);

      const tenant = normalized.tenant || normalized.details?.tenant;
      if (tenant) message.push(`Tenant: ${tenant}`);

      const requestId = normalized.requestId || normalized.request?.id;
      if (requestId) message.push(`RequestId: ${requestId}`);

      if (normalized.downtimeSeconds !== undefined && normalized.downtimeSeconds !== null) {
        message.push(`Downtime(s): ${normalized.downtimeSeconds}`);
      }

      const errorMessage = normalized.error || normalized.message || normalized.details?.message;
      if (errorMessage) message.push(`Error: ${errorMessage}`);

      const cause = normalized.causeProbable || normalized.details?.issue?.message;
      if (cause) message.push(`Cause: ${cause}`);

      if (normalized.health?.database) message.push(`DB: ${normalized.health.database}`);
      if (normalized.health?.memory?.rss) message.push(`Mem: ${normalized.health.memory.rss}`);

      message.push(`Time: ${normalized.timestamp || new Date().toISOString()}`);

      const text = message.join('\n');
      console.log(`[AlertService] Telegram payload: parse_mode=MarkdownV2 text=${JSON.stringify(text)}`);
      
      const telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text,
        }),
      });

      const telegramData = await telegramRes.json().catch(() => null);
      console.log(`[AlertService] Telegram response: status=${telegramRes.status} ok=${telegramData?.ok} description=${telegramData?.description}`);
      if (telegramRes.ok && telegramData?.ok) {
        delivery.telegram = { ok: true, skipped: false };
      } else {
        throw new Error(telegramData?.description || `HTTP ${telegramRes.status}`);
      }
    } catch (err) {
      console.log(`[AlertService] Telegram error: ${err.message}`);
      telegramErrorDetails = extractErrorDetails(err);
      delivery.telegram = {
        ok: false,
        skipped: false,
        error: telegramErrorDetails?.message || 'Erreur envoi Telegram',
        errorDetails: telegramErrorDetails,
      };
    }
  } else {
    console.log(`[AlertService] Telegram skip: channels.telegram=${channels.telegram}, token=${!!telegramBotToken}, chat=${!!telegramChatId}`);
  }

  let whatsappErrorDetails = null;
  if (channels.whatsapp && callMeBotApiKey && callMeBotPhone) {
    try {
      const meta = eventMeta(normalized.event, sev);
      const message = [
        `?? ${meta.title}`,
        `Severity: ${sev}`,
        `Event: ${normalized.event || 'ALERT'}`,
        `Status: ${normalized.status || 'UNKNOWN'}`,
        `HTTP: ${normalized.http || 'N/A'}`,
        `URL: ${normalized.url || 'N/A'}`,
        `Tenant: ${normalized.tenant || 'N/A'}`,
        `Time: ${normalized.timestamp || new Date().toISOString()}`,
      ];
      if (normalized.error) message.push(`Error: ${normalized.error}`);
      if (normalized.causeProbable) message.push(`Cause: ${normalized.causeProbable}`);

      const text = encodeURIComponent(message.join('\n'));
      const whatsappRes = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${callMeBotPhone}&text=${text}&apikey=${callMeBotApiKey}`);
      const whatsappText = await whatsappRes.text().catch(() => '');
      
      if (whatsappRes.ok && (whatsappText.includes('Message queued') || whatsappRes.status === 200)) {
        delivery.whatsapp = { ok: true, skipped: false };
      } else {
        throw new Error(whatsappText || `HTTP ${whatsappRes.status}`);
      }
    } catch (err) {
      whatsappErrorDetails = extractErrorDetails(err);
      delivery.whatsapp = {
        ok: false,
        skipped: false,
        error: whatsappErrorDetails?.message || 'Erreur envoi WhatsApp',
        errorDetails: whatsappErrorDetails,
      };
    }
  }

  const stored = await storeAlert(normalized, sev);
  if (stored) {
    try {
      const mongoose = require('mongoose');
      const Alert = mongoose.connection.models.Alert;
      if (Alert) {
        await Alert.findByIdAndUpdate(stored._id, {
          channelsSent: {
            webhook: {
              generic: !!genericResult?.ok,
              slack: !!slackResult?.ok,
              discord: !!discordResult?.ok,
            },
            email: delivery.email.ok || false,
            telegram: delivery.telegram.ok || false,
            whatsapp: delivery.whatsapp.ok || false,
          },
        });
      }
    } catch {}
  }

  return {
    skipped: false,
    dedup,
    severity: sev,
    delivery,
    webhook: {
      generic: !!genericResult?.ok,
      slack: !!slackResult?.ok,
      discord: !!discordResult?.ok,
    },
    email: delivery.email.ok,
    telegram: delivery.telegram.ok,
    whatsapp: delivery.whatsapp.ok,
    error: emailErrorDetails?.message || null,
  };
};

module.exports = {
  sendAlert,
  extractErrorDetails,
  inferProbableCause,
  sanitizeValue,
};




