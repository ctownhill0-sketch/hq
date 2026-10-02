'use strict';
// Test helpers: in-memory DB, a fake Google endpoint, and a running app on a
// random local port. No real Google calls are ever made in tests.
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config');

const FAKE_PLACE = {
  id: 'ChIJ_fakePlaceId_123456',
  displayName: { text: 'Google Secret Name Agency', languageCode: 'en' },
  formattedAddress: '999 Googleonly Street, Pittsburgh, PA 15222',
  websiteUri: 'https://google-only-website.example.com/',
  nationalPhoneNumber: '(412) 555-0199',
  googleMapsUri: 'https://maps.google.com/?cid=123',
  businessStatus: 'OPERATIONAL',
  rating: 4.9,
};

function fakeGoogle({ notFound = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (notFound) {
      return { ok: false, status: 404, json: async () => ({ error: { code: 404, status: 'NOT_FOUND', message: 'Not found' } }) };
    }
    if (url.endsWith('/places:searchText')) {
      return { ok: true, status: 200, json: async () => ({ places: [FAKE_PLACE] }) };
    }
    return { ok: true, status: 200, json: async () => FAKE_PLACE };
  };
  return { fetchImpl, calls };
}

async function startApp(overrides = {}, fetchImpl = fakeGoogle().fetchImpl, appOptions = {}) {
  const db = openDb(':memory:');
  const base = loadConfig({});
  const config = {
    ...base,
    host: '127.0.0.1', port: 0, dbPath: ':memory:', googleApiKey: 'TEST_KEY_abc123',
    rateLimitPerMinute: 10, rateLimitPerDay: 200, detailsCacheSeconds: 0, languageCode: 'en', regionCode: 'US',
    ...overrides,
    llm: { ...base.llm, ...(overrides.llm || {}) },
    research: { ...base.research, requestIntervalMs: 0, ...(overrides.research || {}) },
  };
  // Port is needed for the Host/Origin checks, so listen first then set it.
  const holder = { app: null };
  const server = await new Promise((resolve) => {
    const s = require('http').createServer((req, res) => holder.app(req, res)).listen(0, '127.0.0.1', () => resolve(s));
  });
  config.port = server.address().port;
  holder.app = createApp({ db, config, fetchImpl, ...appOptions });
  const baseUrl = `http://127.0.0.1:${config.port}`;

  async function request(method, path, body, headers = {}) {
    const init = { method, headers: { 'X-HQ-Desk': '1', ...headers } };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(baseUrl + path, init);
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json };
  }

  return { db, config, base: baseUrl, request, app: holder.app, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { startApp, fakeGoogle, FAKE_PLACE };
