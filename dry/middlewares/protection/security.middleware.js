const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('../../../config/database');

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
        windowMs: config.RATE_LIMIT.windowMs,
        max: config.RATE_LIMIT.max,
        standardHeaders: true,
        legacyHeaders: false,
        message: config.RATE_LIMIT.message,
    });
    app.use('/api', limiter);

    // 3. Protection NoSQL Injection (Remplace la fonction sanitizeData manuelle)
    // Supprime les clés commençant par $ ou contenant des .
    // app.use(mongoSanitize());
};

module.exports = setupSecurity;
