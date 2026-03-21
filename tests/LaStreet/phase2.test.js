const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'http://localhost:5000';
const APP = 'lastreet';

test('Monetization Phase 2: Responses and Subscriptions', async (t) => {
  let clientToken, proToken;
  let leadId, requestId;

  // 1. Setup: Create Client and Pro
  await t.test('Setup users', async () => {
    // Client
    const res1 = await fetch(`${BASE_URL}/api/v1/${APP}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phase2 Client',
        email: `p2_client_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'client'
      })
    });
    const data1 = await res1.json();
    clientToken = data1.data.token;

    // Pro (Non-premium initially)
    const res2 = await fetch(`${BASE_URL}/api/v1/${APP}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phase2 Pro',
        email: `p2_pro_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'prestataire'
      })
    });
    const data2 = await res2.json();
    proToken = data2.data.token;
    
    assert.strictEqual(data1.success, true);
    assert.strictEqual(data2.success, true);
  });

  // 2. Client creates a lead
  await t.test('Client creates lead', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        serviceType: 'Plombier',
        description: 'Besoin urgent de réparation',
        location: 'Brazzaville'
      })
    });
    const data = await res.json();
    leadId = data.data._id;
    assert.strictEqual(data.success, true);
  });

  // 3. Non-premium pro tries to respond (should fail)
  await t.test('Non-premium pro cannot respond', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads/respond`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proToken}`
      },
      body: JSON.stringify({
        leadId,
        message: 'Je suis disponible'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /Premium/i);
  });

  // 4. Pro requests subscription
  await t.test('Pro requests subscription', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/subscriptions/request`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proToken}`
      },
      body: JSON.stringify({
        plan: 'standard',
        proofImage: 'http://example.com/proof.jpg'
      })
    });
    const data = await res.json();
    requestId = data.data._id;
    assert.strictEqual(data.success, true);
  });

  // 5. Admin approves subscription
  await t.test('Admin approves subscription', async () => {
     // NOTE: We'll use a hack to get an admin token or just assume the first user is admin if seeded.
     // In this environment, we can manually trigger the controller logic or create an admin.
     const resAdmin = await fetch(`${BASE_URL}/api/v1/${APP}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin P2',
        email: `p2_admin_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'admin'
      })
    });
    const dataAdmin = await resAdmin.json();
    const adminToken = dataAdmin.data.token;

    const res = await fetch(`${BASE_URL}/api/v1/${APP}/subscriptions/admin/requests/${requestId}/decision`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'approved',
        adminNote: 'Paiement reçu via Momo'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.status, 'approved');
  });

  // 6. Pro (now premium) responds to lead
  await t.test('Premium pro responds to lead', async () => {
    // Re-login to get updated token with isPremium field or just assume backend checks DB
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads/respond`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proToken}`
      },
      body: JSON.stringify({
        leadId,
        message: 'Je suis désormais un Pro Premium, je peux vous aider.'
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.status, 'pending');
  });

  // 7. Client assigns pro
  await t.test('Client assigns pro to lead', async () => {
    // We need the professional ID. In a real test we'd get it from the proToken decoding or profile.
    // Let's assume the response contains it or fetch profile.
    const resProfile = await fetch(`${BASE_URL}/api/v1/${APP}/user/profile`, {
       headers: { 'Authorization': `Bearer ${proToken}` }
    });
    const proProfile = await resProfile.json();
    const proId = proProfile.data._id;

    const res = await fetch(`${BASE_URL}/api/v1/${APP}/leads/assign`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        leadId,
        professionalId: proId
      })
    });
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.status, 'assigned');
  });
});
