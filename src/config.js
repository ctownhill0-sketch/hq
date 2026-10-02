'use strict';
// Loads configuration from .env. The Google key stays in this object on the
// server only: it is never sent to the browser, logged, or put in a URL.
const path = require('path');

function intFrom(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function floatFrom(value, fallback, min, max) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

const EMAIL_RE = /^[^\s@<>()"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;

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

    // ---- Deep Research (LLM). Keys stay server-side, like the Google key. ----
    llm: {
      provider: (env.LLM_PROVIDER || 'anthropic').trim().toLowerCase(),
      model: /^[a-z0-9.\-]{3,80}$/.test(env.LLM_MODEL || '') ? env.LLM_MODEL : 'claude-opus-5-5',
      // Only LLM_API_KEY from .env is used (not a shell ANTHROPIC_API_KEY), so spending is always opt-in.
      apiKey: (env.LLM_API_KEY || '').trim(),
      effort: ['low', 'medium', 'high'].includes(env.LLM_EFFORT) ? env.LLM_EFFORT : 'medium',
      refusalFallback: env.LLM_REFUSAL_FALLBACK !== 'false',
      // Optional price overrides (USD per million tokens) for models not in src/research/cost.js.
      priceInputPerMTok: env.LLM_PRICE_INPUT_PER_MTOK ? floatFrom(env.LLM_PRICE_INPUT_PER_MTOK, NaN, 0, 1000) : null,
      priceOutputPerMTok: env.LLM_PRICE_OUTPUT_PER_MTOK ? floatFrom(env.LLM_PRICE_OUTPUT_PER_MTOK, NaN, 0, 1000) : null,
    },
    research: {
      contactEmail: EMAIL_RE.test((env.RESEARCH_CONTACT_EMAIL || '').trim()) ? env.RESEARCH_CONTACT_EMAIL.trim() : '',
      maxPages: intFrom(env.RESEARCH_MAX_PAGES, 8, 1, 8),
      maxInputTokens: intFrom(env.RESEARCH_MAX_INPUT_TOKENS, 30000, 2000, 150000),
      maxOutputTokens: intFrom(env.RESEARCH_MAX_OUTPUT_TOKENS, 16000, 2000, 32000),
      runsPerDay: intFrom(env.RESEARCH_RUNS_PER_DAY, 10, 1, 200),
      dailySpendCapUsd: floatFrom(env.RESEARCH_DAILY_SPEND_CAP_USD, 3, 0.01, 500),
      requestIntervalMs: 1000, // 1 request/second to the agency's site (not configurable upward)
      timeoutMs: 10000,
      maxBytes: 1.5 * 1024 * 1024,
      maxRedirects: 5,
    },
    licenceLookupUrl: /^https:\/\/[^\s]{4,300}$/.test(env.PA_LICENCE_LOOKUP_URL || '')
      ? env.PA_LICENCE_LOOKUP_URL : 'https://www.insurance.pa.gov/',
  };
}

module.exports = { loadConfig };
