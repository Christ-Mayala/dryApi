const { execSync } = require('node:child_process');

const port = Number.parseInt(process.argv[2] || '5000', 10);

if (!Number.isInteger(port) || port <= 0) {
  console.error('Usage: node scripts/dev/kill-port.js <port>');
  process.exit(1);
}

const platform = process.platform;

try {
  if (platform === 'win32') {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = Array.from(
      new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((pid) => /^\d+$/.test(pid))
      )
    );

    pids.forEach((pid) => execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' }));
  } else {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: 'inherit' });
  }

  console.log(`Processus sur le port ${port} termines.`);
} catch (error) {
  console.warn(`Aucun processus termine sur le port ${port}.`);
}
