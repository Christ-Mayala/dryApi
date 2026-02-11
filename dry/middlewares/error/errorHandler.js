const sendResponse = require('../../utils/http/response');
const logger = require('../../utils/logging/logger');
const config = require('../../../config/database');
const { sendAlert, sanitizeValue } = require('../../services/alert/alert.service');

const looksTechnicalMessage = (msg) => {
    const s = String(msg || '').trim();
    if (!s) return true;
    if (s.length > 250) return true;
    if (s.includes('\n')) return true;
    if (s.includes('`')) return true;

    const badSubs = [
        'TypeError',
        'ReferenceError',
        'SyntaxError',
        'MongoServerError',
        'MongoServerSelectionError',
        'Mongoose',
        'ValidationError',
        'CastError',
        'E11000',
        'ECONN',
        'ENOTFOUND',
        'ERR_',
        'stack',
        ' at ',
        'node:',
    ];
    if (badSubs.some((b) => s.includes(b))) return true;

    if (/^\w*Error:/.test(s)) return true;

    return false;
};

const formatMongooseValidation = (mongooseErr) => {
    const errs = mongooseErr?.errors || {};
    const messages = [];

    for (const [path, detail] of Object.entries(errs)) {
        const kind = detail?.kind;
        if (kind === 'required') {
            messages.push(`Le champ ${path} est requis.`);
        } else if (typeof detail?.message === 'string' && detail.message.trim()) {
            messages.push(detail.message);
        }
    }

    return messages.length ? messages.join(' ') : 'Donnees invalides.';
};

const isClientError = (err) => {
    if (!err) return false;
    if (err?.code === 'LIMIT_FILE_SIZE') return true;
    if (err?.type === 'entity.too.large' || err?.name === 'PayloadTooLargeError') return true;
    if (err?.code === 11000) return true;
    if (err?.name === 'ValidationError' || err?.name === 'CastError') return true;
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') return true;
    if (typeof err?.message === 'string' && err.message === 'Origin not allowed by CORS') return true;
    if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) return true;
    if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) return true;
    return false;
};

const boolFromEnv = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const shouldNotifyAlert = (err) => {
    const alertApiErrors = boolFromEnv(process.env.ALERT_API_ERRORS ?? config.ALERT_API_ERRORS, true);
    if (!alertApiErrors) return false;

    const includeClientErrors = boolFromEnv(process.env.ALERT_API_CLIENT_ERRORS ?? config.ALERT_API_CLIENT_ERRORS, false);
    if (!includeClientErrors && isClientError(err)) return false;
    return true;
};

const buildRequestContext = (req, rid) => {
    return sanitizeValue({
        id: rid,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        referer: req.get('referer'),
        tenant: req.headers['x-tenant-id'] || req.headers['tenant-id'] || req.tenant,
        userId: req.user?.id || req.user?._id || req.user?.userId,
        params: req.params,
        query: req.query,
        body: req.body,
    });
};

const dispatchApiErrorAlert = (err, req, rid, safeMessage) => {
    if (!shouldNotifyAlert(err)) return;

    const urlPath = String(req.originalUrl || '').split('?')[0];
    const dedupKey = `api:${req.method}:${urlPath}:${err?.name || 'Error'}:${err?.code || ''}:${safeMessage || ''}`;
    const tenant = req.headers['x-tenant-id'] || req.headers['tenant-id'] || req.tenant || 'N/A';

    setImmediate(() => {
        sendAlert({
            event: 'DRY_API_EXCEPTION',
            status: 'ERROR',
            requestId: rid,
            http: `${req.method} ${req.originalUrl}`,
            url: req.originalUrl,
            tenant,
            error: err,
            details: {
                publicMessage: safeMessage,
                routePath: urlPath,
            },
            request: buildRequestContext(req, rid),
            dedupKey,
            timestamp: new Date().toISOString(),
        }).catch((alertErr) => {
            const msg = alertErr?.message || String(alertErr);
            logger(`[${rid}] Echec envoi alerte erreur API: ${msg}`, 'error');
        });
    });
};

const errorHandler = async (err, req, res, next) => {
    const route = `${req.method} ${req.originalUrl}`;
    const stack = err?.stack || err?.message || String(err);
    const rid = req.requestId || req.headers['x-request-id'] || 'no-request-id';
    logger(`[${rid}] ${route}\n${stack}`, 'error');

    let message = 'Une erreur est survenue. Veuillez reessayer.';

    if (err?.code === 'LIMIT_FILE_SIZE') {
        message = 'Fichier trop volumineux (max 10MB).';
    } else if (err?.type === 'entity.too.large' || err?.name === 'PayloadTooLargeError') {
        message = 'Donnees envoyees trop volumineuses.';
    } else if (err?.code === 11000) {
        const key = Object.keys(err?.keyValue || {})[0];
        if (key === 'email') message = 'Cet email est deja utilise.';
        else message = 'Valeur deja utilisee.';
    } else if (err?.name === 'ValidationError') {
        message = formatMongooseValidation(err);
    } else if (err?.name === 'CastError') {
        message = 'Identifiant invalide.';
    } else if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
        message = 'Session invalide. Veuillez vous reconnecter.';
    } else if (typeof err?.message === 'string' && err.message === 'Origin not allowed by CORS') {
        message = 'Requete bloquee (CORS). Origine non autorisee.';
    } else if (typeof err?.message === 'string' && !looksTechnicalMessage(err.message)) {
        message = err.message;
    }

    dispatchApiErrorAlert(err, req, rid, message);

    return sendResponse(res, null, message, false);
};

module.exports = errorHandler;
