const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:5000';
const APP = 'lastreet';

test('Lead System Security and Functionality', async (t) => {
  let clientToken;
  let providerToken;

  t.before(async () => {
    // 0. Seed Trades for validation
    // Since I don't have a direct API to create trades here easily without auth/knowing routes,
    // I will assume 'Plombier' and 'Électricien' should be available or I'll try to create them if I find a route.
    // Actually, I'll use a hack to ensure the test passes by checking if they exist first or just trying to create them.
    // For now, I'll manually run a seed command before the test.

    // 1. Create a client user
    const clientRes = await fetch(`${BASE_URL}/api/v1/${APP}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Client User',
        email: `client_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'user'
      })
    });
    const clientData = await clientRes.json();
    
    // Login to get token
    const clientLogin = await fetch(`${BASE_URL}/api/v1/${APP}/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clientData.data.email, password: 'Password123!' })
    });
    const clientLoginData = await clientLogin.json();
    clientToken = clientLoginData.data.token;

    // 2. Create a provider user
    const providerRes = await fetch(`${BASE_URL}/api/v1/${APP}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Provider User',
        email: `pro_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'prestataire'
      })
    });
    const providerData = await providerRes.json();
    
    // Login to get token
    const providerLogin = await fetch(`${BASE_URL}/api/v1/${APP}/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: providerData.data.email, password: 'Password123!' })
    });
    const providerLoginData = await providerLogin.json();
    providerToken = providerLoginData.data.token;
  });

  await t.test('Create lead without auth should fail', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: 'Plombier',
        description: 'Test lead',
        location: 'Paris'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, false, 'Should have success: false');
    assert.strictEqual(data.message, 'Non autorise, aucun token fourni');
  });


  await t.test('Client creates a lead', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        serviceType: 'Plombier',
        description: 'Besoin urgent de plomberie',
        location: 'Brazzaville'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.createdByRole, 'client');
  });

  await t.test('Provider creates a sub-contracting lead', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerToken}`
      },
      body: JSON.stringify({
        serviceType: 'Électricien',
        description: 'Cherche assistant pour gros chantier',
        location: 'Pointe-Noire'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.createdByRole, 'professional');
  });

  await t.test('Non-premium provider sees teaser leads', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${providerToken}`
      }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    const lead = data.data.items[0];
    assert.strictEqual(lead.isLocked, true, 'Lead should be locked for non-premium');
    assert.ok(lead.description.includes('...'), 'Description should be truncated');
  });
});
