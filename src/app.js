'use strict';
// Builds the Express app. Dependencies are injected so tests can use an
// in-memory database and a fake Google endpoint.
const path = require('path');
const express = require('express');
const { hostCheck, csrfCheck, securityHeaders } = require('./security');
const { createPlacesClient } = require('./google/places');
const { createRateLimiter } = require('./google/rateLimit');
const { createDetailsCache } = require('./google/cache');
const { createLlm } = require('./research/llm');
const { createResearchRunner } = require('./research/runner');

/**
 * fetchImpl: used for Google Places. llmFetch: used by the Anthropic SDK.
 * researchResolve / researchTransport: DNS + HTTPS for the research crawler.
 * All are injectable so tests never touch the network.
 */
function createApp({ db, config, fetchImpl = globalThis.fetch, now = () => Date.now(), llmFetch, researchResolve, researchTransport, researchSleep }) {
  const rateLimiter = createRateLimiter({ db, perMinute: config.rateLimitPerMinute, perDay: config.rateLimitPerDay, now });
  const cache = createDetailsCache(config.detailsCacheSeconds, now);
  const places = createPlacesClient({
    apiKey: config.googleApiKey,
    languageCode: config.languageCode,
    regionCode: config.regionCode,
    fetchImpl,
    rateLimiter,
    cache,
  });

  const llm = createLlm({ ...config.llm, fetchImpl: llmFetch });
  const runner = createResearchRunner({
    db, config, llm, resolve: researchResolve, transport: researchTransport, ...(researchSleep ? { sleep: researchSleep } : {}),
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(hostCheck(config.port));
  app.use(securityHeaders);
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));

  const api = express.Router();
  api.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  api.use(csrfCheck(config.port));
  api.use(express.json({ limit: '200kb' }));
  api.use(require('./routes/places')({ places, rateLimiter }));
  api.use(require('./routes/agencies')({ db }));
  api.use(require('./routes/activity')({ db }));
  api.use(require('./routes/export')({ db }));
  api.use(require('./routes/research')({ db, runner, config }));
  api.use(require('./routes/dashboard')({ db }));
  api.use((req, res) => res.status(404).json({ error: 'Not found.' }));

  // Errors: known errors return their message; anything else is generic.
  // Messages never include the API key (see redact() in google/places.js).
  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    if (err.httpStatus) {
      return res.status(err.httpStatus).json({ error: err.message, code: err.code || null, errors: err.errors || undefined });
    }
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'That record already exists.' });
    console.error('[hq-desk] Unexpected error:', err && err.message);
    res.status(500).json({ error: 'Unexpected server error. Check the terminal for details.' });
  });
  app.use('/api', api);
  app.locals.runner = runner;

  return app;
}

module.exports = { createApp };
