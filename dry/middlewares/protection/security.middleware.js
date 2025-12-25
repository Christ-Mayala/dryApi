const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Fonction de nettoyage récursive (Remplace xss-clean et mongo-sanitize)
const sanitizeData = (data) => {
    if (!data) return;

    Object.keys(data).forEach(key => {
        const value = data[key];

        // 1. Protection NoSQL Injection (On supprime les clés commençant par $)
        if (key.startsWith('$')) {
            delete data[key];
            return;
        }

        // 2. Protection XSS basique (On neutralise les balises HTML)
        if (typeof value === 'string') {
            data[key] = value
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        } 
        // 3. Récursivité pour les objets imbriqués
        else if (typeof value === 'object' && value !== null) {
            sanitizeData(value);
        }
    });
};

const setupSecurity = (app) => {
    // 1. Headers de sécurité HTTP (Indispensable)
    app.use(helmet());

    // 2. Limiteur de requêtes (Anti-DDoS / Brute Force)
    const limiter = rateLimit({
        windowMs: 10 * 60 * 1000, // 10 minutes
        max: 100, // 100 requêtes par IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard.' }
    });
    app.use('/api', limiter);

    // 3. Middleware de Sécurité Custom (Compatible Node 25+)
    // Au lieu de remplacer req.query (ce qui plante), on modifie ses valeurs internes.
    app.use((req, res, next) => {
        try {
            if (req.body) sanitizeData(req.body);
            if (req.query) sanitizeData(req.query);
            if (req.params) sanitizeData(req.params);
            next();
        } catch (error) {
            console.error('[SECURITY] Erreur lors du nettoyage des données:', error);
            next(); // On ne bloque pas l'app, mais on log l'erreur
        }
    });
};

module.exports = setupSecurity;