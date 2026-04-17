const baseUrl = process.env.SERVER_URL || process.env.SERVER_URL_TEST || 'http://127.0.0.1:5000';

const main = async () => {
  const response = await fetch(`${baseUrl}/health/ready`);
  if (!response.ok) {
    throw new Error(`Health endpoint indisponible (${response.status})`);
  }

  const body = await response.json();
  if (body.status !== 'READY') {
    throw new Error(`Statut inattendu: ${body.status}`);
  }

  console.log(`[smoke] ${baseUrl}/health/ready => READY`);
};

main().catch((error) => {
  console.error('[smoke] Echec:', error.message);
  process.exit(1);
});
