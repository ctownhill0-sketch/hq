'use strict';
// HQ Desk entry point. Listens on 127.0.0.1 only: never reachable from the network.
require('dotenv').config({ quiet: true });
const { loadConfig } = require('./src/config');
const { openDb } = require('./src/db');
const { seedSampleAgencies } = require('./src/db/seed');
const { createApp } = require('./src/app');

const config = loadConfig();
const db = openDb(config.dbPath);
const seeded = seedSampleAgencies(db);
const app = createApp({ db, config });

const server = app.listen(config.port, config.host, () => {
  console.log(`HQ Desk running at http://${config.host}:${config.port}`);
  console.log(`Database: ${config.dbPath}${seeded ? ` (added ${seeded} fake sample agencies)` : ''}`);
  console.log(config.googleApiKey
    ? `Google Places: enabled (limits ${config.rateLimitPerMinute}/min, ${config.rateLimitPerDay}/day)`
    : 'Google Places: disabled (no GOOGLE_PLACES_API_KEY in .env)');
  const r = app.locals.runner.usage();
  console.log(r.enabled
    ? `Deep Research: enabled (${r.model}, ${config.research.runsPerDay} runs/day, $${config.research.dailySpendCapUsd.toFixed(2)}/day cap)`
    : `Deep Research: disabled (${r.reason})`);
});

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE'
    ? `Port ${config.port} is already in use. Change PORT in .env.`
    : `Server error: ${err.message}`);
  process.exit(1);
});

function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
