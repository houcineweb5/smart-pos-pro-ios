import { createExpressApp } from '../server';
import { initDB, resetDB } from '../server_db';
import assert from 'node:assert';
import test, { before, after } from 'node:test';
import type { Server } from 'node:http';

let server: Server;
let baseUrl: string;

before(async () => {
  await initDB();
  const app = createExpressApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr: any = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('API Security: Unauthenticated request to /api/data is rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/data`);
  assert.strictEqual(res.status, 401, 'Must reject with 401 Unauthorized');
  const body = await res.json();
  assert.strictEqual(body.ok, false);
});

test('API Security: Unauthenticated request to /api/save is rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: [] }),
  });
  assert.strictEqual(res.status, 401);
});

test('API Security: Unauthenticated request to /api/reset is rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(res.status, 401);
});

test('API Security: Valid login produces session token and allows access to /api/data', async () => {
  // Login with admin
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'smartpos' }),
  });
  assert.strictEqual(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.strictEqual(loginBody.ok, true);
  assert.ok(loginBody.token, 'Must return session token');
  assert.strictEqual(loginBody.user.role, 'admin');

  // Use session token to fetch /api/data
  const dataRes = await fetch(`${baseUrl}/api/data`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  assert.strictEqual(dataRes.status, 200);
  const data = await dataRes.json();
  assert.ok(Array.isArray(data.products));
  assert.ok(Array.isArray(data.customers));
  // Verify passwords are not leaked in employees list
  for (const emp of data.employees) {
    assert.strictEqual(emp.passwordHash, '', 'passwordHash must never be leaked over API');
  }
});

test('API Security: Cashier user cannot access admin-only /api/reset (403 Forbidden)', async () => {
  // Login with user1
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user1', password: 'user1' }),
  });
  assert.strictEqual(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.strictEqual(loginBody.user.role, 'user');

  // Attempt to call /api/reset
  const resetRes = await fetch(`${baseUrl}/api/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({}),
  });
  assert.strictEqual(resetRes.status, 403, 'Must reject cashier with 403 Forbidden');
});
