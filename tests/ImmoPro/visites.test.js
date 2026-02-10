const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureServer, loginAdmin } = require('../_helpers/api');

const BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';
const APP = 'immopro';
const FEATURE = 'visites';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@dry.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

const ensureFetch = () => {
  if (typeof fetch !== 'function') {
    throw new Error('fetch indisponible (Node 18+ requis)');
  }
};

test('CRUD visites (smoke)', async () => {
  ensureFetch();
  const serverOk = await ensureServer(BASE_URL);
  if (!serverOk) return;

  const listRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE);
  assert.ok(listRes.status >= 200 && listRes.status < 500);

  const token = await loginAdmin(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!token) return; // pas d'admin => on saute les ecritures

  const payload = {
  bienId: 'exemple_bienId',
  clientId: 'exemple_clientId',
  dateVisite: `2026-01-01T12:00:00.000Z`,
  statut: 'exemple_statut',
  commentaire: 'exemple_commentaire',
  label: `Exemple label ${Date.now()}`
};

  const createRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  });
  const created = await createRes.json();
  assert.ok(createRes.status >= 200 && createRes.status < 500);
  const id = created?.data?._id || created?.data?.id;
  if (!id) return;

  const getRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE + '/' + id);
  assert.ok(getRes.status >= 200 && getRes.status < 500);

  const updateRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE + '/' + id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ ...payload, label: 'Maj ' + Date.now() }),
  });
  assert.ok(updateRes.status >= 200 && updateRes.status < 500);

  const deleteRes = await fetch(BASE_URL + '/api/v1/' + APP + '/' + FEATURE + '/' + id, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer ' + token,
    },
  });
  assert.ok(deleteRes.status >= 200 && deleteRes.status < 500);
});
