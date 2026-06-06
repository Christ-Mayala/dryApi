/**
 * Bannière de démarrage — DRY API
 * Affiche l'état du système et toutes les URLs disponibles au démarrage
 * @module dry/bootstrap/startup-banner
 */

const config = require('../../config/database');
const healthService = require('../services/health/health.service');

const BOX_WIDTH = 84;
const LABEL_WIDTH = 16;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  magenta: '\x1b[35m',
};

const formatLine = (label, value) => {
  const safeValue = String(value ?? '');
  return `${colors.dim}${String(label).padEnd(LABEL_WIDTH, ' ')}${colors.reset} ${safeValue}`;
};

const colorizeState = (state) => {
  if (state === 'OK') return `${colors.green}[OK]${colors.reset}`;
  if (state === 'WARN') return `${colors.yellow}[WARN]${colors.reset}`;
  return `${colors.blue}[INFO]${colors.reset}`;
};

/**
 * Collecte toutes les URLs exposées par le système
 */
const collectSystemUrls = (port, baseUrl) => {
  const apps = ['freellm', 'lastreet', 'mediadl', 'scim', 'skillforge', 'spiritemeraude'];

  const urls = [
    { category: '🏠 Général', items: [
      { label: 'Racine API', url: baseUrl },
      { label: 'Health (Live)', url: `${baseUrl}/health/live` },
      { label: 'Health (Ready)', url: `${baseUrl}/health/ready` },
      { label: 'Health (Startup)', url: `${baseUrl}/health/startup` },
      { label: 'Métriques Prometheus', url: `${baseUrl}/health/metrics` },
    ]},
    { category: '📖 Documentation', items: [
      { label: 'Swagger UI', url: `${baseUrl}/api-docs` },
      { label: 'Swagger JSON', url: `${baseUrl}/api-docs.json` },
    ]},
    { category: '📊 Monitoring', items: [
      { label: 'Dashboard Système', url: `${baseUrl}/system/status` },
      { label: 'JSON Status', url: `${baseUrl}/system/status.json` },
    ]},
    { category: '💳 Billing', items: [
      { label: 'Plans', url: `${baseUrl}/api/v1/billing/plans` },
      { label: 'Checkout', url: `${baseUrl}/api/v1/billing/checkout-session` },
      { label: 'Factures', url: `${baseUrl}/api/v1/billing/invoices` },
      { label: 'Webhook Stripe', url: `${baseUrl}/api/v1/billing/webhooks/stripe` },
    ]},
    { category: '🔑 Licensing', items: [
      { label: 'Générer licence', url: `${baseUrl}/api/v1/licensing/generate` },
      { label: 'Activer licence', url: `${baseUrl}/api/v1/licensing/activate` },
      { label: 'Valider licence', url: `${baseUrl}/api/v1/licensing/validate` },
      { label: 'Features par tier', url: `${baseUrl}/api/v1/licensing/features` },
      { label: 'Mon statut', url: `${baseUrl}/api/v1/licensing/check` },
    ]},
    { category: '🔌 Applications', items: apps.map((app) => ({
      label: app.charAt(0).toUpperCase() + app.slice(1),
      url: `${baseUrl}/api/v1/${app}`,
    }))},
  ];

  return urls;
};

/**
 * Affiche une section d'URLs dans la console
 */
const printUrlSection = (title, urls, baseUrl) => {
  console.log(`\n  ${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`  ${colors.dim}${'-'.repeat(BOX_WIDTH - 4)}${colors.reset}`);

  urls.forEach(({ label, url }) => {
    const relativePath = url.replace(baseUrl, '');
    console.log(`    ${colors.green}→${colors.reset} ${colors.bright}${label.padEnd(20)}${colors.reset} ${colors.dim}${relativePath}${colors.reset}`);
  });
};

const printStartupBanner = async (port, allowedOrigins) => {
  const overview = await healthService.getSystemOverview(port);
  const baseUrl = overview.urls.base || `http://localhost:${port}`;
  const urlSections = collectSystemUrls(port, baseUrl);

  // ── En-tête ──
  console.log('');
  console.log(`${colors.green}${'█'.repeat(BOX_WIDTH)}${colors.reset}`);
  console.log(`${colors.bright}${colors.green}  🚀  DRY API SERVER READY  ${colors.reset}`);
  console.log(`${colors.dim}  Framework multi-tenant — version ${overview.version || config.APP_VERSION || '1.0.0'}${colors.reset}`);
  console.log(`${colors.green}${'█'.repeat(BOX_WIDTH)}${colors.reset}`);

  // ─── SYSTEM OVERVIEW ──
  console.log(`\n${colors.bright}${colors.magenta}  ⚙ SYSTEM OVERVIEW${colors.reset}`);
  console.log(`  ${colors.dim}${'─'.repeat(BOX_WIDTH - 4)}${colors.reset}`);
  console.log(formatLine('Port', `${colors.bright}${colors.white}${port}${colors.reset}`));
  console.log(formatLine('Environnement', `${colors.bright}${config.NODE_ENV}${colors.reset}`));
  console.log(formatLine('Base URL', `${colors.bright}${colors.cyan}${baseUrl}${colors.reset}`));

  overview.items.forEach((item) => {
    console.log(formatLine(item.label, `${colorizeState(item.state)} ${item.value}`));
  });

  // ─── URLs ──
  console.log(`\n${colors.bright}${colors.magenta}  📍 ENDPOINTS DISPONIBLES${colors.reset}`);
  console.log(`  ${colors.dim}${'─'.repeat(BOX_WIDTH - 4)}${colors.reset}`);

  urlSections.forEach(({ category, items }) => {
    printUrlSection(category, items, baseUrl);
  });

  // ─── Applications ──
  console.log(`\n${colors.bright}${colors.magenta}  🔌 APPLICATIONS MULTI-TENANT${colors.reset}`);
  console.log(`  ${colors.dim}${'─'.repeat(BOX_WIDTH - 4)}${colors.reset}`);

  const apps = overview.applications || overview.health?.services?.applications || [];
  if (apps.length > 0) {
    apps.forEach((app) => {
      const fullUrl = `${baseUrl}/api/v1/${app.name.toLowerCase()}`;
      const features = app.features || 0;
      console.log(`    ${colors.green}✔${colors.reset} ${colors.bright}${String(app.name).padEnd(16)}${colors.reset} ${colors.dim}→${colors.reset} ${colors.cyan}${fullUrl}${colors.reset}  ${colors.dim}(${features} features)${colors.reset}`);
    });
  } else {
    console.log(`    ${colors.yellow}ℹ Aucune application détectée${colors.reset}`);
  }

  // ─── Pied de page ──
  console.log(`\n  ${colors.dim}${'─'.repeat(BOX_WIDTH - 4)}${colors.reset}`);
  console.log(`  ${colors.dim}📅 ${new Date().toISOString()}  |  🛡 ${allowedOrigins.length} origine(s) CORS autorisée(s)${colors.reset}`);
  console.log(`${colors.green}${'█'.repeat(BOX_WIDTH)}${colors.reset}\n`);
};

module.exports = {
  printStartupBanner,
};
