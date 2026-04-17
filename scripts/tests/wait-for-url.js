const targetUrl = process.argv[2];
const timeoutMs = Number.parseInt(process.argv[3] || '30000', 10);
const intervalMs = 1000;

if (!targetUrl) {
  console.error('Usage: node scripts/tests/wait-for-url.js <url> [timeoutMs]');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        console.log(`[wait] ${targetUrl} disponible.`);
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timeout en attendant ${targetUrl}: ${lastError?.message || 'inconnu'}`);
};

main().catch((error) => {
  console.error('[wait] Echec:', error.message);
  process.exit(1);
});
