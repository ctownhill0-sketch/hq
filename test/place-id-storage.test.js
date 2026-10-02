'use strict';
// GOOGLE RULE 2: assert that after searching, saving and viewing details,
// no Google-derived content exists anywhere in the database.
const test = require('node:test');
const assert = require('node:assert');
const { startApp, FAKE_PLACE } = require('./helpers');

function dumpDatabase(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
  return JSON.stringify(tables.map((t) => db.prepare(`SELECT * FROM "${t}"`).all()));
}

const GOOGLE_VALUES = [
  FAKE_PLACE.displayName.text, FAKE_PLACE.formattedAddress, FAKE_PLACE.websiteUri, 'google-only-website',
  FAKE_PLACE.nationalPhoneNumber, FAKE_PLACE.googleMapsUri, 'Googleonly', String(FAKE_PLACE.rating),
];

test('search + save + details stores only the place ID', async () => {
  const app = await startApp();
  try {
    const search = await app.request('POST', '/api/places/search', { city: 'Pittsburgh', query: 'insurance agency' });
    assert.strictEqual(search.status, 200);
    assert.strictEqual(search.body.results[0].name, FAKE_PLACE.displayName.text); // shown to the browser...

    const saved = await app.request('POST', '/api/agencies', { place_id: FAKE_PLACE.id });
    assert.strictEqual(saved.status, 201);
    const details = await app.request('GET', `/api/places/${FAKE_PLACE.id}`);
    assert.strictEqual(details.status, 200);

    // ...but never written to disk.
    const dump = dumpDatabase(app.db);
    for (const v of GOOGLE_VALUES) assert.ok(!dump.includes(v), `DB must not contain Google value: ${v}`);
    assert.ok(dump.includes(FAKE_PLACE.id), 'DB should contain the place ID');

    const row = app.db.prepare('SELECT * FROM agencies WHERE id = ?').get(saved.body.id);
    assert.strictEqual(row.place_id, FAKE_PLACE.id);
    assert.strictEqual(row.manual_name, null);
    assert.strictEqual(row.manual_website, null);
    assert.strictEqual(row.manual_phone, null);
    assert.strictEqual(row.label, null);
  } finally { await app.close(); }
});

test('save endpoint rejects any Google field alongside the place ID', async () => {
  const app = await startApp();
  try {
    for (const extra of [{ name: 'X' }, { formattedAddress: 'Y' }, { manual_name: 'Z' }, { website: 'https://a.b' }]) {
      const r = await app.request('POST', '/api/agencies', { place_id: FAKE_PLACE.id, ...extra });
      assert.strictEqual(r.status, 400, JSON.stringify(extra));
    }
    assert.strictEqual(app.db.prepare('SELECT COUNT(*) n FROM agencies').get().n, 0);
  } finally { await app.close(); }
});

test('Google agencies cannot have manual_* fields set via PATCH', async () => {
  const app = await startApp();
  try {
    const { body } = await app.request('POST', '/api/agencies', { place_id: FAKE_PLACE.id });
    const r = await app.request('PATCH', `/api/agencies/${body.id}`, { manual_name: FAKE_PLACE.displayName.text });
    assert.strictEqual(r.status, 400);
  } finally { await app.close(); }
});

test('export contains own data and place IDs only', async () => {
  const app = await startApp();
  try {
    await app.request('POST', '/api/places/search', { city: 'Pittsburgh', query: 'insurance' });
    await app.request('POST', '/api/agencies', { place_id: FAKE_PLACE.id });
    const r = await app.request('GET', '/api/export/my-data.json');
    assert.strictEqual(r.status, 200);
    const text = JSON.stringify(r.body);
    for (const v of GOOGLE_VALUES) assert.ok(!text.includes(v), `export must not contain: ${v}`);
    assert.ok(text.includes(FAKE_PLACE.id));
  } finally { await app.close(); }
});

test('field mask is always sent and the key never appears in URLs', async () => {
  const { fakeGoogle } = require('./helpers');
  const g = fakeGoogle();
  const app = await startApp({}, g.fetchImpl);
  try {
    await app.request('POST', '/api/places/search', { city: 'Pittsburgh', query: 'insurance' });
    await app.request('GET', `/api/places/${FAKE_PLACE.id}`);
    assert.strictEqual(g.calls.length, 2);
    for (const c of g.calls) {
      assert.ok(c.init.headers['X-Goog-FieldMask'], 'field mask header required');
      assert.ok(!c.url.includes('TEST_KEY'), 'key must not be in URL');
    }
    assert.strictEqual(g.calls[0].init.headers['X-Goog-FieldMask'],
      'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.businessStatus');
  } finally { await app.close(); }
});

test('stale place ID returns NOT_FOUND and can be relinked', async () => {
  const { fakeGoogle } = require('./helpers');
  const app = await startApp({}, fakeGoogle({ notFound: true }).fetchImpl);
  try {
    const { body } = await app.request('POST', '/api/agencies', { place_id: FAKE_PLACE.id });
    const r = await app.request('GET', `/api/places/${FAKE_PLACE.id}`);
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.body.code, 'NOT_FOUND');
    assert.match(r.body.error, /no longer available/i);
    const relink = await app.request('PUT', `/api/agencies/${body.id}/place`, { place_id: 'ChIJ_newPlaceId_999999' });
    assert.strictEqual(relink.status, 200);
    assert.strictEqual(app.db.prepare('SELECT place_id FROM agencies WHERE id = ?').get(body.id).place_id, 'ChIJ_newPlaceId_999999');
  } finally { await app.close(); }
});
