require('dotenv').config();

const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

const parsePort = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port);
  });
};

const waitForReady = async (baseUrl, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health/ready`);
      if (response.ok) return true;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
};

const runNodeScript = (relativePath, extraArgs = [], env = process.env) => {
  return spawnSync(process.execPath, [relativePath, ...extraArgs], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
};

const buildTestEnv = (port, baseUrl) => ({
  ...process.env,
  PORT: String(port),
  PORT_DEV: String(port),
  PORT_TEST: String(port),
  SERVER_URL: baseUrl,
  SERVER_URL_DEV: baseUrl,
  SERVER_URL_TEST: baseUrl,
});

const main = async () => {
  const rawServerUrl = process.env.SERVER_URL;
  let configuredServerUrl = null;
  let configuredPort = null;
  let configuredHost = null;
  let configuredIsLocal = false;

  if (rawServerUrl) {
    try {
      const url = new URL(rawServerUrl);
      configuredHost = url.hostname;
      configuredIsLocal = ['localhost', '127.0.0.1', '::1'].includes(configuredHost);
      configuredPort = url.port ? parsePort(url.port, null) : null;
      configuredServerUrl = rawServerUrl.replace(/\/+$/, '');
    } catch {}
  }

  const preferredPort = configuredPort ?? parsePort(process.env.PORT, 5000);
  const preferredHost = configuredHost && configuredIsLocal ? configuredHost : '127.0.0.1';
  const buildLocalBaseUrl = (port) => `http://${preferredHost}:${port}`;

  let serverProcess = null;
  let baseUrl = configuredServerUrl || buildLocalBaseUrl(preferredPort);
  let selectedPort = preferredPort;

  if (configuredServerUrl && !configuredIsLocal) {
    const ready = await waitForReady(configuredServerUrl, 30000);
    if (!ready) throw new Error("SERVER_URL est defini mais le serveur n'est pas pret.");
  } else {
    const candidatePorts = Array.from({ length: 25 }, (_, index) => preferredPort + index);

    let started = false;
    for (const candidatePort of candidatePorts) {
      const candidateBaseUrl = buildLocalBaseUrl(candidatePort);

      // eslint-disable-next-line no-await-in-loop
      const alreadyRunning = await waitForReady(candidateBaseUrl, 1500);
      if (alreadyRunning) {
        baseUrl = candidateBaseUrl;
        selectedPort = candidatePort;
        started = true;
        break;
      }

      // eslint-disable-next-line no-await-in-loop
      const seemsAvailable = await isPortAvailable(candidatePort);
      if (!seemsAvailable) continue;

      const env = buildTestEnv(candidatePort, candidateBaseUrl);
      serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: ROOT,
        env,
        stdio: 'inherit',
      });

      // Wait until ready or process exits early (EADDRINUSE, config error, etc.)
      // eslint-disable-next-line no-await-in-loop
      const outcome = await Promise.race([
        waitForReady(candidateBaseUrl, 30000).then((ready) => ({ type: 'ready', ready })),
        new Promise((resolve) =>
          serverProcess.once('exit', (code) => resolve({ type: 'exit', code }))
        ),
      ]);

      if (outcome.type === 'ready' && outcome.ready) {
        baseUrl = candidateBaseUrl;
        selectedPort = candidatePort;
        started = true;
        break;
      }

      if (serverProcess) serverProcess.kill();
      serverProcess = null;
    }

    if (!started) {
      throw new Error("Le serveur local n'est pas pret pour les tests d'integration.");
    }
  }

  const env = buildTestEnv(selectedPort, baseUrl);

  try {
    const seedResult = runNodeScript('scripts/seed/seed-all.js', [], env);
    if (seedResult.status !== 0) {
      throw new Error('Le seed local a echoue.');
    }

    const testsResult = runNodeScript(
      'scripts/tests/test-runner.js',
      ['--suite', 'integration'],
      env
    );
    process.exit(testsResult.status || 0);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
};

main().catch((error) => {
  console.error(`[test:integration] ${error.message}`);
  process.exit(1);
});
