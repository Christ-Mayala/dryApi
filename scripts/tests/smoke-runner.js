require('dotenv').config();

const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

const parsePort = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(hostname);

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

const buildEnv = (port, baseUrl) => ({
  ...process.env,
  PORT: String(port),
  PORT_DEV: String(port),
  PORT_TEST: String(port),
  SERVER_URL: baseUrl,
  SERVER_URL_DEV: baseUrl,
  SERVER_URL_TEST: baseUrl,
});

const getConfiguredBaseUrl = () =>
  process.env.SERVER_URL || process.env.SERVER_URL_TEST || 'http://127.0.0.1:5000';

const main = async () => {
  let baseUrl = getConfiguredBaseUrl().replace(/\/+$/, '');
  let serverProcess = null;
  try {
    const url = new URL(baseUrl);
    if (!isLocalHost(url.hostname)) {
      const ready = await waitForReady(baseUrl, 30000);
      if (!ready) throw new Error('Health endpoint indisponible (serveur distant non joignable)');
    } else {
      const initialPort = parsePort(url.port, 5000);
      const candidatePorts = Array.from({ length: 10 }, (_, index) => initialPort + index);

      let started = false;
      for (const candidatePort of candidatePorts) {
        const candidateBaseUrl = `http://${url.hostname}:${candidatePort}`;

        // eslint-disable-next-line no-await-in-loop
        const alreadyRunning = await waitForReady(candidateBaseUrl, 1500);
        if (alreadyRunning) {
          baseUrl = candidateBaseUrl;
          started = true;
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        const seemsAvailable = await isPortAvailable(candidatePort);
        if (!seemsAvailable) continue;

        serverProcess = spawn(process.execPath, ['server.js'], {
          cwd: ROOT,
          env: buildEnv(candidatePort, candidateBaseUrl),
          stdio: 'inherit',
        });

        // eslint-disable-next-line no-await-in-loop
        const ready = await Promise.race([
          waitForReady(candidateBaseUrl, 30000),
          new Promise((resolve) => serverProcess.once('exit', () => resolve(false))),
        ]);

        if (ready) {
          baseUrl = candidateBaseUrl;
          started = true;
          break;
        }

        if (serverProcess) serverProcess.kill();
        serverProcess = null;
      }

      if (!started) {
        throw new Error('Health endpoint indisponible (impossible de demarrer le serveur local)');
      }
    }

    const response = await fetch(`${baseUrl}/health/ready`);
    if (!response.ok) {
      throw new Error(`Health endpoint indisponible (${response.status})`);
    }

    const body = await response.json();
    if (body.status !== 'READY') {
      throw new Error(`Statut inattendu: ${body.status}`);
    }

    console.log(`[smoke] ${baseUrl}/health/ready => READY`);
  } finally {
    if (serverProcess) serverProcess.kill();
  }
};

main().catch((error) => {
  console.error('[smoke] Echec:', error.message);
  process.exit(1);
});
