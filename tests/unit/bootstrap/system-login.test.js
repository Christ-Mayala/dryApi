/**
 * Tests unitaires — Connexion /system/status (middleware mot de passe + formulaire)
 *
 * Vérifie le flux complet de la page de connexion réécrite :
 *  - Formulaire HTML NATIF (aucun JavaScript inline → compatible CSP
 *    `script-src 'self'` de Helmet, plus de Google Fonts bloquées)
 *  - Champ `name="password"` réellement envoyé au POST (bug 401 d'origine)
 *  - Ouverture de session (cookie connect.sid) après mot de passe correct
 *  - Bandeau d'erreur visible sur mot de passe incorrect
 *  - Réponse JSON propre pour les clients API (Accept: application/json)
 */
const OLD_ENV = { ...process.env };

process.env.SYSTEM_PASSWORD = 'test-system-password';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'a'.repeat(32);
process.env.SESSION_SECRET = 'b'.repeat(32);

// ── Mocks des dépendances lourdes (pas de DB, pas d'alertes, pas de swagger) ──
jest.mock('../../../dry/services/health/health.service', () => ({
  getHealthStatus: jest.fn().mockResolvedValue({ status: 'OK', uptime: 123 }),
  getSystemOverview: jest.fn().mockResolvedValue({
    uptime: 123,
    memory: { used: 100 },
    db: 'UP',
    status: 'OK',
  }),
  renderSystemStatusPage: jest.fn(
    (overview) => `<html><body>STATUS OK uptime=${overview.uptime}</body></html>`
  ),
}));

jest.mock('../../../dry/core/application/bootloader', () => ({
  bootstrapApps: jest.fn(async () => {}),
}));

jest.mock('../../../dry/middlewares/error/errorHandler', () =>
  jest.fn((err, req, res, next) =>
    res.status(500).json({ success: false, message: err.message })
  )
);

jest.mock('../../../dry/middlewares/protection/csrf.middleware', () => ({
  handleCsrfError: jest.fn((err, req, res, next) => next(err)),
}));

jest.mock('../../../dry/core/factories/modelFactory', () => jest.fn(() => ({})));

jest.mock('../../../dry/utils/documentation/swagger.util', () => ({
  swaggerUiMiddleware: jest.fn((req, res, next) => next()),
  swaggerUiSetup: jest.fn((req, res) => res.send('swagger')),
  generateSwaggerRoutes: jest.fn(() => ({})),
}));

jest.mock('../../../dry/config/prometheus.config', () => ({
  createMetrics: jest.fn(() => ({})),
  httpMetricsMiddleware: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../dry/modules/billing/billing.routes', () =>
  jest.fn((req, res, next) => next())
);
jest.mock('../../../dry/modules/licensing/licensing.routes', () =>
  jest.fn((req, res, next) => next())
);
jest.mock('../../../dry/modules/senepay/senepay.routes', () =>
  jest.fn((req, res, next) => next())
);
jest.mock('../../../dry/routes/alerts.routes', () =>
  jest.fn((req, res, next) => next())
);
jest.mock('../../../dry/routes/health.routes', () =>
  jest.fn((req, res, next) => next())
);

const express = require('express');
const session = require('express-session');

const buildApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, sameSite: 'lax', httpOnly: true },
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // require paresseux : routes.js lit SYSTEM_PASSWORD au chargement
  const { registerHealthRoutes } = require('../../../dry/bootstrap/routes');
  registerHealthRoutes(app);

  // 404 catch-all (sinon Express renvoie son 404 HTML par défaut)
  app.use((req, res) => res.status(404).json({ success: false, message: 'not found' }));
  return app;
};

const startServer = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () =>
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${server.address().port}`,
      })
    );
  });

describe('Connexion /system/status (formulaire natif, sans JS inline)', () => {
  let server;
  let base;

  beforeAll(async () => {
    ({ server, baseUrl: base } = await startServer(buildApp()));
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    process.env = OLD_ENV;
  });

  const extractSessionCookie = (res) => {
    const setCookie = res.headers.get('set-cookie') || '';
    const sid = setCookie.split(';')[0];
    return sid && sid.startsWith('connect.sid=') ? sid : null;
  };

  it('GET sans session → 401 avec la page de connexion (formulaire natif)', async () => {
    const res = await fetch(`${base}/system/status`);
    expect(res.status).toBe(401);

    const html = await res.text();
    // Champ mot de passe avec le bon name (le bug d'origine : name absent → 401 systématique)
    expect(html).toContain('name="password"');
    expect(html).toContain('type="submit"');
    // Formulaire natif qui POST vers lui-même (aucune action JS requise)
    expect(html).toContain('<form method="POST" action="/system/status">');
    // Aucun JavaScript inline (compat CSP script-src 'self') ni Google Fonts (compat style-src)
    expect(html).not.toContain('<script');
    expect(html).not.toContain('googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('POST avec un mauvais mot de passe → 401 + bandeau d\'erreur, pas de session', async () => {
    const res = await fetch(`${base}/system/status`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'password=mauvais-mot-de-passe',
    });
    expect(res.status).toBe(401);

    const html = await res.text();
    expect(html).toContain('Mot de passe incorrect');
    // Le formulaire est toujours là pour réessayer
    expect(html).toContain('name="password"');
    // Aucune session ouverte
    expect(extractSessionCookie(res)).toBeNull();
  });

  it('POST avec le bon mot de passe (formulaire) → 303 + session, puis GET 200', async () => {
    const res = await fetch(`${base}/system/status`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `password=${process.env.SYSTEM_PASSWORD}`,
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/system/status');

    const sid = extractSessionCookie(res);
    expect(sid).not.toBeNull();

    // Avec le cookie de session, la page du panneau s'affiche
    const panel = await fetch(`${base}/system/status`, { headers: { Cookie: sid } });
    expect(panel.status).toBe(200);
    expect(await panel.text()).toContain('STATUS OK');
  });

  it('POST avec le bon mot de passe en JSON (client API/fetch) → 303 + session', async () => {
    const res = await fetch(`${base}/system/status`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.SYSTEM_PASSWORD }),
    });
    expect(res.status).toBe(303);
    expect(extractSessionCookie(res)).not.toBeNull();
  });

  it('Client API (Accept: application/json) sans mot de passe → 401 JSON explicite', async () => {
    const res = await fetch(`${base}/system/status`, {
      headers: { Accept: 'application/json' },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain('Mot de passe requis');
  });

  it('Client API POST JSON (sans en-tête Accept) avec mauvais mot de passe → 401 JSON', async () => {
    // req.is('json') : un client API qui POSTe du JSON sans en-tête Accept
    // explicite (curl, scripts) reçoit quand même un 401 JSON lisible.
    const res = await fetch(`${base}/system/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'mauvais' }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain('Mot de passe requis');
  });

  it('La page de connexion n\'est jamais mise en cache (Cache-Control: no-store)', async () => {
    const res = await fetch(`${base}/system/status`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
