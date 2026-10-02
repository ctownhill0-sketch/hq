'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startApp, fakeGoogle, FAKE_PLACE } = require('./helpers');
const { openDb } = require('../src/db');
const { createRateLimiter } = require('../src/google/rateLimit');
const { createDetailsCache } = require('../src/google/cache');

test('per-minute limit refuses calls beyond the cap with a clear message', async () => {
  const g = fakeGoogle();
  const app = await startApp({ rateLimitPerMinute: 3, rateLimitPerDay: 100 }, g.fetchImpl);
  try {
    for (let i = 0; i < 3; i++) {
      assert.strictEqual((await app.request('POST', '/api/places/search', { city: 'Erie', query: 'insurance' })).status, 200);
    }
    const r = await app.request('POST', '/api/places/search', { city: 'Erie', query: 'insurance' });
    assert.strictEqual(r.status, 429);
    assert.strictEqual(r.body.code, 'RATE_LIMITED');
    assert.match(r.body.error, /per-minute/i);
    assert.strictEqual(g.calls.length, 3, 'refused call must not reach Google');
  } finally { await app.close(); }
});

test('daily limit is enforced and reported in /api/status', async () => {
  const g = fakeGoogle();
  const app = await startApp({ rateLimitPerMinute: 100, rateLimitPerDay: 2 }, g.fetchImpl);
  try {
    await app.request('GET', `/api/places/${FAKE_PLACE.id}`);
    await app.request('GET', `/api/places/${FAKE_PLACE.id}`);
    const r = await app.request('GET', `/api/places/${FAKE_PLACE.id}`);
    assert.strictEqual(r.status, 429);
    assert.match(r.body.error, /daily/i);
    const s = await app.request('GET', '/api/status');
    assert.deepStrictEqual([s.body.usage.usedToday, s.body.usage.perDay], [2, 2]);
    assert.strictEqual(g.calls.length, 2);
  } finally { await app.close(); }
});

test('per-minute window frees up after 60 seconds; daily count survives a "restart"', () => {
  const db = openDb(':memory:');
  let t = new Date(2026, 0, 15, 12, 0, 0).getTime();
  const now = () => t;
  const rl = createRateLimiter({ db, perMinute: 2, perDay: 3, now });
  rl.consume(); rl.consume();
  assert.throws(() => rl.consume(), /per-minute/i);
  t += 60_001;
  rl.consume();
  // A new limiter (as after a server restart) still sees today's count of 3.
  const rl2 = createRateLimiter({ db, perMinute: 2, perDay: 3, now });
  assert.throws(() => rl2.consume(), /daily/i);
  // Next day resets.
  t += 24 * 3600_000;
  rl2.consume();
});

test('details cache is off by default and capped under 5 minutes', () => {
  let t = 0;
  const off = createDetailsCache(0, () => t);
  off.set('a', 1);
  assert.strictEqual(off.get('a'), null);
  const c = createDetailsCache(10_000, () => t); // asks for hours, gets < 5 minutes
  c.set('a', 1);
  t = 298_000;
  assert.strictEqual(c.get('a'), 1);
  t = 300_000;
  assert.strictEqual(c.get('a'), null);
});

test('missing API key: app still runs and search explains how to fix it', async () => {
  const g = fakeGoogle();
  const app = await startApp({ googleApiKey: '' }, g.fetchImpl);
  try {
    const s = await app.request('GET', '/api/status');
    assert.strictEqual(s.body.googleEnabled, false);
    const r = await app.request('POST', '/api/places/search', { city: 'Erie', query: 'insurance' });
    assert.strictEqual(r.status, 503);
    assert.match(r.body.error, /GOOGLE_PLACES_API_KEY/);
    assert.strictEqual(g.calls.length, 0);
    assert.strictEqual((await app.request('GET', '/api/agencies')).status, 200);
  } finally { await app.close(); }
});

test('API key is redacted from Google error messages', async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: { status: 'INVALID_ARGUMENT', message: 'bad key TEST_KEY_abc123 here' } }) });
  const app = await startApp({}, fetchImpl);
  try {
    const r = await app.request('POST', '/api/places/search', { city: 'Erie', query: 'insurance' });
    assert.strictEqual(r.status, 502);
    assert.ok(!JSON.stringify(r.body).includes('TEST_KEY_abc123'));
    assert.match(r.body.error, /\[redacted\]/);
  } finally { await app.close(); }
});
