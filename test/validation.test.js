'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { startApp } = require('./helpers');

async function withApp(fn) {
  const app = await startApp();
  try { await fn(app); } finally { await app.close(); }
}

test('rejects invalid place IDs', () => withApp(async (app) => {
  for (const place_id of ['', 'short', 'has spaces in it here', '../../etc/passwd', '<script>alert(1)</script>', 123]) {
    assert.strictEqual((await app.request('POST', '/api/agencies', { place_id })).status, 400, String(place_id));
  }
  assert.strictEqual((await app.request('GET', '/api/places/bad%20id')).status, 400);
}));

test('manual agency: required name, URL scheme and phone format are validated', () => withApp(async (app) => {
  assert.strictEqual((await app.request('POST', '/api/agencies/manual', {})).status, 400);
  assert.strictEqual((await app.request('POST', '/api/agencies/manual', { manual_name: '   ' })).status, 400);
  assert.strictEqual((await app.request('POST', '/api/agencies/manual', { manual_name: 'A', manual_website: 'javascript:alert(1)' })).status, 400);
  assert.strictEqual((await app.request('POST', '/api/agencies/manual', { manual_name: 'A', manual_phone: '<b>1</b>' })).status, 400);
  assert.strictEqual((await app.request('POST', '/api/agencies/manual', { manual_name: 'x'.repeat(201) })).status, 400);
  const ok = await app.request('POST', '/api/agencies/manual', { manual_name: 'Real Agency', manual_website: 'https://a.example.com', manual_phone: '(215) 555-0100' });
  assert.strictEqual(ok.status, 201);
}));

test('enums, dates and declined-reason rule are enforced', () => withApp(async (app) => {
  const { body } = await app.request('POST', '/api/agencies/manual', { manual_name: 'A' });
  const id = body.id;
  assert.strictEqual((await app.request('PATCH', `/api/agencies/${id}`, { pipeline_stage: 'won' })).status, 400);
  assert.strictEqual((await app.request('PATCH', `/api/agencies/${id}`, { handles_apartments: 'maybe' })).status, 400);
  assert.strictEqual((await app.request('PATCH', `/api/agencies/${id}`, { pipeline_stage: 'declined' })).status, 400);
  assert.strictEqual((await app.request('PATCH', `/api/agencies/${id}`, { pipeline_stage: 'declined', decline_reason: 'Has a tool already' })).status, 200);
  assert.strictEqual((await app.request('PATCH', `/api/agencies/${id}`, { evil_column: 1 })).status, 400);

  const call = { contacted_at: '2026-10-02T10:00', channel: 'call', outcome: 'conversation' };
  assert.strictEqual((await app.request('POST', `/api/agencies/${id}/calls`, { ...call, outcome: 'great' })).status, 400);
  assert.strictEqual((await app.request('POST', `/api/agencies/${id}/calls`, { ...call, contacted_at: '2026-02-30T10:00' })).status, 400);
  assert.strictEqual((await app.request('POST', `/api/agencies/${id}/calls`, { ...call, next_action_date: '2026-10-09' })).status, 400);
  assert.strictEqual((await app.request('POST', `/api/agencies/${id}/calls`, { ...call, discovery: { bogus: 'x' } })).status, 400);
  const ok = await app.request('POST', `/api/agencies/${id}/calls`, {
    ...call, next_action: 'Send demo invite', next_action_date: '2026-10-09', discovery: { bottleneck: 'Re-keying loss runs' },
  });
  assert.strictEqual(ok.status, 201);
  assert.ok(ok.body.task_id, 'next action creates a task');
  assert.strictEqual((await app.request('POST', '/api/tasks', { title: 'x', due_date: '10/09/2026' })).status, 400);
  assert.strictEqual((await app.request('POST', '/api/tasks', { title: 'x', agency_id: 99999 })).status, 404);
  assert.strictEqual((await app.request('GET', '/api/agencies/abc')).status, 400);
}));

test('text is stored as data, not markup (SQL/HTML payloads are inert)', () => withApp(async (app) => {
  const payload = "'); DROP TABLE agencies; -- <img src=x onerror=alert(1)>";
  const { body } = await app.request('POST', '/api/agencies/manual', { manual_name: payload });
  const got = await app.request('GET', `/api/agencies/${body.id}`);
  assert.strictEqual(got.body.agency.manual_name, payload);
  assert.strictEqual((await app.request('GET', '/api/agencies')).status, 200);
}));

test('CSRF and host protections', () => withApp(async (app) => {
  const noHeader = await fetch(`${app.base}/api/agencies/manual`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manual_name: 'A' }),
  });
  assert.strictEqual(noHeader.status, 403);
  const badOrigin = await app.request('POST', '/api/agencies/manual', { manual_name: 'A' }, { Origin: 'https://evil.example' });
  assert.strictEqual(badOrigin.status, 403);
  const formPost = await fetch(`${app.base}/api/agencies/manual`, {
    method: 'POST', headers: { 'X-HQ-Desk': '1', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'manual_name=A',
  });
  assert.strictEqual(formPost.status, 415);
  const http = require('http');
  const status = await new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port: app.config.port, path: '/api/status', headers: { Host: 'attacker.example' } }, (res) => resolve(res.statusCode));
  });
  assert.strictEqual(status, 403);
  assert.strictEqual(app.db.prepare('SELECT COUNT(*) n FROM agencies').get().n, 0);
}));

test('malformed JSON gives a clear 400', () => withApp(async (app) => {
  const r = await app.request('POST', '/api/agencies/manual', '{not json');
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /not valid JSON/);
}));
