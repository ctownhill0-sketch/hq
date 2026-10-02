'use strict';
// Creates the database file (if needed), applies migrations and adds the
// fake sample agencies. Safe to run more than once.
require('dotenv').config({ quiet: true });
const { loadConfig } = require('../src/config');
const { openDb } = require('../src/db');
const { seedSampleAgencies } = require('../src/db/seed');

const config = loadConfig();
const db = openDb(config.dbPath);
const n = seedSampleAgencies(db);
console.log(`Database ready: ${config.dbPath}${n ? ` (added ${n} fake sample agencies)` : ''}`);
db.close();
