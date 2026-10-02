'use strict';
// Google Places proxy. The browser never talks to Google and never sees the key.
// Results are returned to the browser for display only and are NOT stored
// (GOOGLE RULE 2, see src/google/places.js).
const express = require('express');
const { validate, ValidationError } = require('../validate');
const { PLACE_ID_RE } = require('../google/places');

module.exports = function placesRoutes({ places, rateLimiter }) {
  const r = express.Router();

  r.get('/status', (req, res) => {
    res.json({ googleEnabled: places.enabled, usage: rateLimiter.status() });
  });

  r.post('/places/search', async (req, res, next) => {
    try {
      const input = validate(req.body, {
        city: { type: 'text', max: 100, required: true },
        query: { type: 'text', max: 150, required: true },
      });
      const results = await places.searchText(`${input.query} in ${input.city}`);
      res.json({ results, usage: rateLimiter.status() });
    } catch (e) { next(e); }
  });

  r.get('/places/:placeId', async (req, res, next) => {
    try {
      if (!PLACE_ID_RE.test(req.params.placeId)) throw new ValidationError(['placeId: invalid']);
      const place = await places.getDetails(req.params.placeId);
      res.json({ place, usage: rateLimiter.status() });
    } catch (e) { next(e); }
  });

  return r;
};
