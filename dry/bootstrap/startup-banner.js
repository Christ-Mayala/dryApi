const config = require('../../config/database');
const healthService = require('../services/health/health.service');

const BOX_WIDTH = 78;
const LABEL_WIDTH = 14;

const formatLine = (label, value, colors) => {
  const safeValue = String(value ?? '');
  return `${colors.dim}${label.padEnd(LABEL_WIDTH, ' ')}${colors.reset} ${safeValue}`;
};

const wrapList = (values, indentWidth) => {
  const wrappedLines = [];
  let currentLine = '';
  const maxWidth = BOX_WIDTH - indentWidth;

  values.forEach((value) => {
    const chunk = currentLine ? `, ${value}` : value;
    if ((currentLine + chunk).length > maxWidth) {
      wrappedLines.push(currentLine);
      currentLine = value;
      return;
    }

    currentLine += chunk;
  });

  if (currentLine) {
    wrappedLines.push(currentLine);
  }

  return wrappedLines.length ? wrappedLines : ['aucune origine configuree'];
};

const colorizeState = (state, colors) => {
  if (state === 'OK') return `${colors.green}[OK]${colors.reset}`;
  if (state === 'WARN') return `${colors.yellow}[WARN]${colors.reset}`;
  return `${colors.blue}[INFO]${colors.reset}`;
};

const printStartupBanner = async (port, allowedOrigins) => {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    white: '\x1b[37m',
  };

  const overview = await healthService.getSystemOverview(port);
  const corsLines = wrapList(allowedOrigins, LABEL_WIDTH + 4);

  console.log('');
  console.log(`${colors.green}${'='.repeat(BOX_WIDTH)}${colors.reset}`);
  console.log(`${colors.bright}${colors.green}DRY API SERVER READY${colors.reset}`);
  console.log(`${colors.dim}Bootstrap termine, services principaux en ligne.${colors.reset}`);
  console.log(`${colors.green}${'='.repeat(BOX_WIDTH)}${colors.reset}`);

  console.log(`\n${colors.bright}${colors.cyan}SYSTEM OVERVIEW${colors.reset}`);
  console.log(`${colors.dim}${'-'.repeat(BOX_WIDTH)}${colors.reset}`);
  console.log(formatLine('Port', `${colors.bright}${colors.white}${port}${colors.reset}`, colors));
  console.log(
    formatLine('Environment', `${colors.bright}${config.NODE_ENV}${colors.reset}`, colors)
  );

  overview.items.forEach((item) => {
    console.log(
      formatLine(item.label, `${colorizeState(item.state, colors)} ${item.value}`, colors)
    );
  });

  console.log(formatLine('CORS', corsLines[0], colors));
  corsLines.slice(1).forEach((line) => {
    console.log(`${' '.repeat(LABEL_WIDTH + 1)} ${line}`);
  });

  console.log(
    formatLine(
      'Dashboard',
      `${colors.bright}${colors.cyan}${overview.urls.systemStatus}${colors.reset}`,
      colors
    )
  );

  console.log(`${colors.dim}${'-'.repeat(BOX_WIDTH)}${colors.reset}`);
  console.log('');
};

module.exports = {
  printStartupBanner,
};
