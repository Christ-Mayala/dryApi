require('dotenv').config();

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const port = process.env.PORT || '5000';
const baseUrl = process.env.SERVER_URL || `http://127.0.0.1:${port}`;

const waitForReady = async (timeoutMs = 30000) => {
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

const main = async () => {
  const env = {
    ...process.env,
    SERVER_URL: baseUrl,
  };

  let serverProcess = null;
  const alreadyRunning = await waitForReady(1500);

  if (!alreadyRunning) {
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });

    const ready = await waitForReady(30000);
    if (!ready) {
      if (serverProcess) serverProcess.kill();
      throw new Error("Le serveur local n'est pas pret pour les tests d'integration.");
    }
  }

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
