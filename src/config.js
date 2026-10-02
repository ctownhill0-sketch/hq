'use strict';
// Loads configuration from .env. The Google key stays in this object on the
// server only: it is never sent to the browser, logged, or put in a URL.
const path = require('path');

function intFrom(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function loadConfig(env = process.env) {
  const root = path.resolve(__dirname, '..');
  const dbPath = env.DB_PATH ? path.resolve(root, env.DB_PATH) : path.join(root, 'data', 'hq-desk.db');
  return {
    host: '127.0.0.1', // Never configurable: local-only by design.
    port: intFrom(env.PORT, 4317, 1024, 65535),
    dbPath,
    googleApiKey: (env.GOOGLE_PLACES_API_KEY || '').trim(),
    rateLimitPerMinute: intFrom(env.GOOGLE_RATE_LIMIT_PER_MINUTE, 10, 1, 1000),
    rateLimitPerDay: intFrom(env.GOOGLE_RATE_LIMIT_PER_DAY, 200, 1, 100000),
    // Capped below 5 minutes regardless of .env (see src/google/places.js rule 2).
    detailsCacheSeconds: intFrom(env.PLACE_DETAILS_CACHE_SECONDS, 0, 0, 299),
    languageCode: /^[a-zA-Z-]{2,10}$/.test(env.GOOGLE_LANGUAGE_CODE || '') ? env.GOOGLE_LANGUAGE_CODE : 'en',
    regionCode: /^[a-zA-Z]{2}$/.test(env.GOOGLE_REGION_CODE || '') ? env.GOOGLE_REGION_CODE : 'US',
  };
}

module.exports = { loadConfig };
