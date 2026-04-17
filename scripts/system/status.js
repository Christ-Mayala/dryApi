require('dotenv').config();

const port = process.env.PORT || '5000';
const baseUrl = process.env.SERVER_URL || `http://127.0.0.1:${port}`;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bright: '\x1b[1m',
};

const badge = (state) => {
  if (state === 'OK') return `${colors.green}[OK]${colors.reset}`;
  if (state === 'WARN') return `${colors.yellow}[WARN]${colors.reset}`;
  return `${colors.blue}[INFO]${colors.reset}`;
};

const main = async () => {
  const response = await fetch(`${baseUrl}/system/status.json`);
  if (!response.ok) {
    throw new Error(`Impossible de recuperer le status (${response.status})`);
  }

  const overview = await response.json();

  console.log(`\n${colors.bright}DRY System Status${colors.reset}`);
  console.log(`${overview.headline} | env=${overview.environment} | uptime=${overview.uptime.human}`);
  console.log('');

  overview.items.forEach((item) => {
    console.log(`${badge(item.state)} ${item.label.padEnd(14, ' ')} ${item.value}`);
  });

  console.log('');
  console.log(`Swagger: ${overview.urls.swagger}`);
  console.log(`Page:    ${overview.urls.systemStatus}`);
};

main().catch((error) => {
  console.error(`[status] ${error.message}`);
  process.exit(1);
});
