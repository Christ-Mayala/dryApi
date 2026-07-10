const bootstrapApps = require('../core/application/bootloader');
const errorHandler = require('../middlewares/error/errorHandler');
const { handleCsrfError } = require('../middlewares/protection/csrf.middleware');
const sendResponse = require('../utils/http/response');
const healthService = require('../services/health/health.service');
const systemActionsService = require('../services/system/system-actions.service');
const getModel = require('../core/factories/modelFactory');
const {
  swaggerUiMiddleware,
  swaggerUiSetup,
  generateSwaggerRoutes,
} = require('../utils/documentation/swagger.util');

// Nouveaux modules (Phase 2)
const { createMetrics, httpMetricsMiddleware } = require('../config/prometheus.config');
const healthRoutes = require('../routes/health.routes');
const billingRoutes = require('../modules/billing/billing.routes');
const licensingRoutes = require('../modules/licensing/licensing.routes');
// const googleAuthRoutes = require('../modules/auth/auth.routes'); // COMMENTÉ
const senePayRoutes = require("../modules/senepay/senepay.routes");

// Middleware de protection par mot de passe pour les routes système
if (!process.env.SYSTEM_PASSWORD) {
  throw new Error(
    'SYSTEM_PASSWORD doit être défini dans les variables d\'environnement. ' +
    'Ajoutez SYSTEM_PASSWORD=<mot_de_passe_fort> dans votre fichier .env'
  );
}
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD;

const systemPasswordMiddleware = (req, res, next) => {
  const password = SYSTEM_PASSWORD;
  
  // Vérifier si déjà authentifié via session
  if (req.session && req.session.systemAuth === true) {
    return next();
  }
  
  // Vérifier le mot de passe uniquement dans le body (POST) — jamais en query string (logs)
  const provided = req.body?.password;
  if (provided && provided === password) {
    if (req.session) req.session.systemAuth = true;
    return next();
  }
  
  // Si la requête PRÉFÈRE explicitement JSON (API/fetch), renvoyer 401 JSON.
  // req.accepts('json') seul est trompeur : un navigateur classique envoie
  // "Accept: text/html,...,*/*" — le "*/*" matche JSON aussi, donc
  // req.accepts('json') renvoyait vrai même pour une navigation normale,
  // qui n'a jamais le formulaire de connexion en résultat.
  // req.accepts(['html','json']) choisit le type réellement préféré.
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(401).json({
      success: false,
      message: 'Mot de passe requis. Ouvrez cette URL dans un navigateur pour voir le formulaire de connexion, ou envoyez un POST avec { "password": "VOTRE_MOT_DE_PASSE" } dans le corps JSON (jamais en query string, pour ne pas l\'exposer dans les logs).',
    });
  }

  // Afficher une page de connexion simple
  res.status(401).send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Accès protégé — DRY API</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Inter',sans-serif; background:#0f172a; color:#e2e8f0; min-height:100vh; display:flex; align-items:center; justify-content:center; }
.login-card { background:#1e293b; border:1px solid #334155; border-radius:16px; padding:48px 40px; width:100%; max-width:420px; text-align:center; }
.login-card h1 { font-size:1.5em; margin-bottom:8px; }
.login-card p { color:#94a3b8; font-size:0.95em; margin-bottom:32px; }
.login-card input[type="password"] { width:100%; padding:14px 16px; background:#0f172a; border:1px solid #334155; border-radius:10px; color:#e2e8f0; font-size:1em; font-family:inherit; outline:none; transition:border-color 0.2s; margin-bottom:16px; }
.login-card input[type="password"]:focus { border-color:#3b82f6; }
.login-card button { width:100%; padding:14px; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; border:none; border-radius:10px; font-size:1em; font-weight:600; cursor:pointer; font-family:inherit; transition:transform 0.2s; }
.login-card button:hover { transform:translateY(-1px); }
.login-card .error { color:#ef4444; font-size:0.9em; margin-top:12px; display:none; }
</style>
</head><body>
<div class="login-card">
<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:20px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
<h1>Accès protégé</h1>
<p>Cette page est sécurisée. Entrez le mot de passe pour continuer.</p>
<form method="POST" action="?" onsubmit="return false">
<input type="password" id="pwdField" placeholder="Mot de passe" autofocus>
<button type="button" onclick="submitPassword()">Accéder</button>
<div class="error" id="error" style="display:none;color:#ef4444;font-size:0.9em;margin-top:12px;">Mot de passe incorrect</div>
</form>
</div>
<script>
function submitPassword() {
  const pwd = document.getElementById('pwdField').value;
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = window.location.pathname;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'password';
  input.value = pwd;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}
</script>
</body></html>`);
};

const registerHealthRoutes = (app) => {
  // Route racine avec status du serveur (déplacée sur /health/root pour ne pas conflit avec la landing page)
  // Protégée par mot de passe comme les autres routes système
  app.get('/health/root', systemPasswordMiddleware, async (req, res) => {
    try {
      const health = await healthService.getHealthStatus();
      const statusCode = health.status === 'OK' ? 200 : 503;
      res.status(statusCode).json({
        success: health.status === 'OK',
        message: 'DRY Multi-Tenant Server Running',
        ...health,
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: 'Health check failed',
        error: error.message,
      });
    }
  });

  // Endpoints de health dédiés (montés dans /health via healthRoutes)
  app.use('/health', healthRoutes);

  // Métriques Prometheus (/metrics) via le routeur health
  // Note: GET /metrics est géré par healthRoutes

  // System status (protégé par mot de passe)
  app.get('/system/status.json', systemPasswordMiddleware, async (req, res) => {
    const overview = await healthService.getSystemOverview();
    res.status(200).json(overview);
  });

  app.get('/system/status', systemPasswordMiddleware, async (req, res) => {
    const overview = await healthService.getSystemOverview();
    res.status(200).send(healthService.renderSystemStatusPage(overview));
  });

  // Actions système (protégées par mot de passe)
  app.post('/system/actions/create-app', systemPasswordMiddleware, async (req, res) => {
    const { appName, template, addons } = req.body;
    try {
      const result = await systemActionsService.createApp(appName, template, addons);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/system/actions/:actionId', systemPasswordMiddleware, async (req, res) => {
    const { actionId } = req.params;
    try {
      const result = await systemActionsService.runCommand(actionId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

const registerDocumentationRoutes = (app) => {
  const swaggerSpecs = generateSwaggerRoutes();

  // Documentation protégée par mot de passe
  app.use('/api-docs', systemPasswordMiddleware, swaggerUiMiddleware, swaggerUiSetup);
  app.get('/api-docs.json', systemPasswordMiddleware, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
  });
};

const registerApplicationRoutes = async (app) => {
  // Initialiser les métriques Prometheus
  const metrics = createMetrics();
  
  // Middleware de tracking HTTP Prometheus (après toutes les routes)
  app.use(httpMetricsMiddleware(metrics));

  // Bootstrap des apps multi-tenant
  await bootstrapApps(app);

  // Routes système
  registerHealthRoutes(app);
  registerDocumentationRoutes(app);

  // Middleware qui injecte req.getModel et req.appName pour les routes globales
  // (senepay, billing) qui sont hors du scope du bootloader multi-tenant
  const injectTrivida = (req, res, next) => {
    if (!req.appName) req.appName = 'Trivida';
    if (!req.getModel) req.getModel = (modelName, schema) => getModel('Trivida', modelName, schema);
    next();
  };

  app.use("/api/v1/senepay", injectTrivida, senePayRoutes);
  app.use('/api/v1/billing', injectTrivida, billingRoutes);

  // Route de callback paiement — redirige vers le deep link de l'app mobile
  // SenePay successUrl pointe vers cette URL HTTPS, qui redirige ensuite vers l'app
  app.get('/payment/callback', (req, res) => {
    const token = req.query.token || '';
    // Redirection vers le deep link Trivida
    const deepLink = `com.christ_mayala.trivida://payment/callback?token=${token}`;
    res.redirect(302, deepLink);
  });

  // Routes licensing
  // // Routes Google OAuth (multi-tenant, flux serveur) — COMMENTÉ
  // app.use('/api', googleAuthRoutes);
  app.use('/api/v1/licensing', licensingRoutes);

  // 404
  app.use((req, res) => sendResponse(res, null, 'Route introuvable', false));
  
  // Gestion d'erreurs
  app.use(handleCsrfError);
  app.use(errorHandler);
};

module.exports = {
  registerApplicationRoutes,
  registerDocumentationRoutes,
  registerHealthRoutes,
};
