const sendResponse = require('../../utils/response');
const logger = require('../../utils/logger');

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

    return messages.length ? messages.join(' ') : 'Données invalides.';
};

const errorHandler = async (err, req, res, next) => {
    const route = `${req.method} ${req.originalUrl}`;
    const stack = err?.stack || err?.message || String(err);
    logger(`${route}\n${stack}`, 'error');

    let message = 'Une erreur est survenue. Veuillez réessayer.';

    if (err?.code === 'LIMIT_FILE_SIZE') {
        message = 'Fichier trop volumineux (max 10MB).';
    } else if (err?.type === 'entity.too.large' || err?.name === 'PayloadTooLargeError') {
        message = 'Données envoyées trop volumineuses.';
    } else if (err?.code === 11000) {
        const key = Object.keys(err?.keyValue || {})[0];
        if (key === 'email') message = 'Cet email est déjà utilisé.';
        else message = 'Valeur déjà utilisée.';
    } else if (err?.name === 'ValidationError') {
        message = formatMongooseValidation(err);
    } else if (err?.name === 'CastError') {
        message = 'Identifiant invalide.';
    } else if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
        message = 'Session invalide. Veuillez vous reconnecter.';
    } else if (typeof err?.message === 'string' && err.message === 'Origin not allowed by CORS') {
        message = 'Requête bloquée (CORS). Origine non autorisée.';
    } else if (typeof err?.message === 'string' && !looksTechnicalMessage(err.message)) {
        message = err.message;
    }

    return sendResponse(res, null, message, false);
};

module.exports = errorHandler;