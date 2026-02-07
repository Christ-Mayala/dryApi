const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Fonction de nettoyage recursive (Remplace xss-clean et mongo-sanitize)
const sanitizeData = (data) => {
    if (!data) return;

    Object.keys(data).forEach((key) => {
        const value = data[key];

        // 1. Protection NoSQL Injection (On supprime les cles commencant par $)
        if (key.startsWith('$')) {
            delete data[key];
            return;
        }

        // 2. Protection XSS basique (On neutralise les balises HTML)
        if (typeof value === 'string') {
            data[key] = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else if (typeof value === 'object' && value !== null) {
            // 3. Recursivite pour les objets imbriques
            sanitizeData(value);
        }
    });
};

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

    // 3. Middleware de securite custom
    // Au lieu de remplacer req.query (ce qui plante), on modifie ses valeurs internes.
    app.use((req, res, next) => {
        try {
            if (req.body) sanitizeData(req.body);
            if (req.query) sanitizeData(req.query);
            if (req.params) sanitizeData(req.params);
            next();
        } catch (error) {
            console.error('[SECURITY] Erreur lors du nettoyage des donnees:', error);
            next();
        }
    });
};

module.exports = setupSecurity;
