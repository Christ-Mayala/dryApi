const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = 'http://127.0.0.1:5000';

const APP = 'lastreet';

const ensureFetch = () => {
  if (typeof fetch !== 'function') throw new Error('fetch indisponible (Node 18+ requis)');
};

test('LaStreet Authentication Flow', async (t) => {
  ensureFetch();

  const testUser = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'Password123!',
    role: 'user'
  };

  await t.test('Register new user', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    
    const json = await res.json();
    assert.strictEqual(res.status, 200, `Registration failed: ${json.message}`);
    assert.strictEqual(json.success, true);
    assert.ok(json.data._id);
  });

  await t.test('Login with new user', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      }),
    });
    
    const json = await res.json();
    assert.strictEqual(res.status, 200, `Login failed: ${json.message}`);
    assert.strictEqual(json.success, true);
    assert.ok(json.data.token);
    assert.ok(json.data.user);
    
    testUser.token = json.data.token;
  });

  await t.test('Get profile', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/user/profile`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${testUser.token}`
      },
    });
    
    const json = await res.json();
    assert.strictEqual(res.status, 200, `Get profile failed: ${json.message}`);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.email, testUser.email);
  });

  await t.test('Change password', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/${APP}/user/password`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUser.token}`
      },
      body: JSON.stringify({
        currentPassword: testUser.password,
        newPassword: 'NewPassword123!'
      }),
    });
    
    const json = await res.json();
    assert.strictEqual(res.status, 200, `Change password failed: ${json.message}`);
    assert.strictEqual(json.success, true);
  });
});
