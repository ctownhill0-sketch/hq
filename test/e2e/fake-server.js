'use strict';
// A throwaway HQ Desk server for browser tests: in-memory database, the fake
// sample agencies, one Google-listed agency, and a FAKE Google endpoint.
// No real Google (or any other) network call is ever made.
const { openDb } = require('../../src/db');
const { seedSampleAgencies } = require('../../src/db/seed');
const { createApp } = require('../../src/app');
const { loadConfig } = require('../../src/config');
const { fakeGoogle, FAKE_PLACE } = require('../helpers');

function startFakeServer(port) {
  const db = openDb(':memory:');
  seedSampleAgencies(db);
  db.prepare("INSERT INTO agencies (place_id, source, pipeline_stage) VALUES (?, 'google', 'researched')").run(FAKE_PLACE.id);
  db.prepare("INSERT INTO demos (agency_id, scheduled_at, notes) VALUES (3, strftime('%Y-%m-%dT10:00', 'now', 'localtime', '+2 day'), 'Walk through fictional renewal file')").run();
  const base = loadConfig({});
  const config = { ...base, port, googleApiKey: 'fake-key-for-tests', llm: { ...base.llm, apiKey: '' } };
  const app = createApp({ db, config, fetchImpl: fakeGoogle().fetchImpl });
  return new Promise((resolve) => {
    const server = app.listen(port, '127.0.0.1', () => resolve({ db, close: () => new Promise((r) => server.close(r)) }));
  });
}

module.exports = { startFakeServer };
if (require.main === module) startFakeServer(Number(process.argv[2] || 4398)).then(() => console.log('fake server up'));
