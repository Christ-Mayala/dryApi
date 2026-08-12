/**
 * Tests unitaires — Handler CORS (dry/bootstrap/http.js)
 * Vérifie la détection d'origine en production : liste blanche stricte,
 * plus aucun bypass "origin.includes('localhost')".
 */
const OLD_ENV = { ...process.env };

describe('buildCorsOriginHandler (production)', () => {
  let handler;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://localhost:27017/dryapi_test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'b'.repeat(32);
    process.env.PORT = '5000';
    process.env.ALLOWED_ORIGINS =
      'https://app.example.com,https://pelerin.netlify.app,http://localhost:4200';
    process.env.LOG_REQUESTS = 'false';

    const { buildCorsOriginHandler } = require('../../../dry/bootstrap/http');
    handler = buildCorsOriginHandler([
      'https://app.example.com',
      'https://pelerin.netlify.app',
      'http://localhost:4200',
    ]);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const allow = (origin) =>
    new Promise((resolve) => handler(origin, (err, ok) => resolve({ err, ok })));

  it('accepte une origine listée exactement', async () => {
    const r = await allow('https://app.example.com');
    expect(r.err).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('accepte une origine locale listée exactement', async () => {
    const r = await allow('http://localhost:4200');
    expect(r.err).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('normalise le slash final', async () => {
    const r = await allow('https://app.example.com/');
    expect(r.err).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('bloque une origine qui CONTIENT "localhost" mais non listée (ancien bypass)', async () => {
    const r = await allow('https://localhost.evil.com');
    expect(r.err).toBeInstanceOf(Error);
    expect(r.ok).toBeUndefined();
  });

  it('bloque un port localhost non listé', async () => {
    const r = await allow('http://localhost:8080');
    expect(r.err).toBeInstanceOf(Error);
  });

  it("accepte un sous-domaine d'une origine Netlify autorisée", async () => {
    const r = await allow('https://admin.pelerin.netlify.app');
    expect(r.err).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('bloque une origine inconnue', async () => {
    const r = await allow('https://evil.com');
    expect(r.err).toBeInstanceOf(Error);
  });

  it('accepte les requêtes sans en-tête Origin (curl, serveur à serveur)', async () => {
    const r = await allow(undefined);
    expect(r.err).toBeNull();
    expect(r.ok).toBe(true);
  });

  it("accepte Origin 'null' (WebView Android, navigateur intégré d'app)", async () => {
    const r = await allow('null');
    expect(r.err).toBeNull();
    expect(r.ok).toBe(true);
  });
});

describe('isSameOrigin (requêtes same-origin)', () => {
  let isSameOrigin;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.NODE_ENV = 'production';
    const { isSameOrigin: fn } = require('../../../dry/bootstrap/http');
    isSameOrigin = fn;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('reconnaît une origine identique à l\'hôte (POST formulaire /system/status)', () => {
    expect(isSameOrigin('https://dryapi.onrender.com', 'dryapi.onrender.com')).toBe(true);
  });

  it('reconnaît le schéma http avec port', () => {
    expect(isSameOrigin('http://localhost:5000', 'localhost:5000')).toBe(true);
  });

  it('ignore la casse et le slash final', () => {
    expect(isSameOrigin('HTTPS://DryApi.OnRender.com/', 'dryapi.onrender.com')).toBe(true);
  });

  it('rejette une origine cross-origin', () => {
    expect(isSameOrigin('https://evil.com', 'dryapi.onrender.com')).toBe(false);
  });

  it('rejette quand l\'origine ou l\'hôte manque', () => {
    expect(isSameOrigin(undefined, 'dryapi.onrender.com')).toBe(false);
    expect(isSameOrigin('https://dryapi.onrender.com', undefined)).toBe(false);
  });

  it('rejette une origine cross-origin sur le même domaine parent', () => {
    expect(isSameOrigin('https://evil.dryapi.onrender.com', 'dryapi.onrender.com')).toBe(false);
  });
});
