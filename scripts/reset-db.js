'use strict';
// DELETES the local database and recreates it empty (plus sample agencies).
// Requires --yes. Make a backup first (see README).
require('dotenv').config({ quiet: true });
const fs = require('fs');
const { loadConfig } = require('../src/config');

if (!process.argv.includes('--yes')) {
  console.error('This permanently deletes all your HQ Desk data.');
  console.error('Stop the server, back up the database, then run: npm run db:reset -- --yes');
  process.exit(1);
}
const { dbPath } = loadConfig();
for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`Deleted ${f}`); }
}
require('./init-db');
