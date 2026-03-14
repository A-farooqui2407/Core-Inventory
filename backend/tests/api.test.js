/**
 * Backend API tests. Run with: NODE_ENV=test node --test tests/api.test.js
 * (Windows: set NODE_ENV=test && node --test tests/api.test.js)
 */
import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { app } from '../server.js';

test('GET /api/health returns 200 and ok: true', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.ok, true);
    assert.ok(data.timestamp);
  } finally {
    server.close();
  }
});

test('GET /api/auth/status returns authEnabled', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/api/auth/status`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.ok, true);
    assert.ok(typeof data.data?.authEnabled === 'boolean');
  } finally {
    server.close();
  }
});

test('GET /api/products returns 200 and items array', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/api/products`);
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.ok, true);
    assert.ok(Array.isArray(data.data?.items));
    assert.ok(typeof data.data?.total === 'number');
  } finally {
    server.close();
  }
});
