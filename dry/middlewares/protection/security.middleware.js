const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const setupSecurity = (app) => {
    const isProd = process.env.NODE_ENV === 'production';

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
        windowMs: 10 * 60 * 1000, // 10 minutes
        max: 100, // 100 requetes par IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Trop de requetes, veuillez reessayer plus tard.' },
    });
    app.use('/api', limiter);

    // 3. Protection NoSQL Injection (Remplace la fonction sanitizeData manuelle)
    // Supprime les clés commençant par $ ou contenant des .
    // app.use(mongoSanitize());
};

module.exports = setupSecurity;
