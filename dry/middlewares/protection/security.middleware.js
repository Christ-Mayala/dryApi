const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('../../../config/database');

const isAdminApiPath = (req) => {
    const url = String(req?.originalUrl || req?.url || '');
    return /^\/api\/v1\/[^/]+\/admin(?:\/|$)/i.test(url);
};

const hasBearerToken = (req) => {
    const auth = String(req?.headers?.authorization || '');
    return /^Bearer\s+/i.test(auth);
};

const getTokenBucket = (req) => {
    const auth = String(req?.headers?.authorization || '');
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return '';
    return crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
};

const getMaxForRequest = (req) => {
    const base = Number(config?.RATE_LIMIT?.max || 100);
    const authMultiplier = Number(config?.RATE_LIMIT?.authMultiplier || 10);
    const adminMultiplier = Number(config?.RATE_LIMIT?.adminMultiplier || 50);

    if (isAdminApiPath(req)) return Math.max(base * adminMultiplier, base);
    if (hasBearerToken(req)) return Math.max(base * authMultiplier, base);
    return base;
};

const shouldSkipRateLimit = (req) => {
    const path = String(req?.path || '');
    if (path.startsWith('/health/')) return true;
    if (config?.RATE_LIMIT?.skipAdmin && isAdminApiPath(req)) return true;
    if (config?.RATE_LIMIT?.skipAuthenticated && hasBearerToken(req)) return true;
    return false;
};

const setupSecurity = (app) => {
    const isProd = config.NODE_ENV === 'production';

    // 1. Headers de securite HTTP (CSP/HSTS/Referrer en prod)
    app.use(
        helmet({
            contentSecurityPolicy: isProd
                ? {
                    useDefaults: true,
                    directives: {
                        "img-src": ["'self'", 'data:'],
                        "script-src": ["'self'"],
                        "style-src": ["'self'", "'unsafe-inline'"],
                    },
                }
                : false,
            referrerPolicy: { policy: 'no-referrer' },
            hsts: isProd
                ? { maxAge: 31536000, includeSubDomains: true, preload: true }
                : false,
            crossOriginResourcePolicy: { policy: 'same-site' },
        })
    );

    // 2. Limiteur de requetes (Anti-DDoS / Brute Force)
    const limiter = rateLimit({
        windowMs: Number(config?.RATE_LIMIT?.windowMs || 10 * 60 * 1000),
        max: (req) => getMaxForRequest(req),
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            const tokenBucket = getTokenBucket(req);
            if (tokenBucket) return `auth:${tokenBucket}`;
            return rateLimit.keyGeneratorIpFallback(req);
        },
        skip: shouldSkipRateLimit,
        message: config.RATE_LIMIT.message,
    });
    app.use('/api', limiter);

    // 3. Protection NoSQL Injection (Remplace la fonction sanitizeData manuelle)
    // Supprime les clés commençant par $ ou contenant des .
    // app.use(mongoSanitize());
};

module.exports = setupSecurity;
