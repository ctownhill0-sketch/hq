'use strict';
/*
 * ===========================================================================
 * GOOGLE PLACES POLICY RULES FOR HQ DESK
 * ---------------------------------------------------------------------------
 * RE-VERIFY THESE AGAINST GOOGLE'S CURRENT POLICY PAGES BEFORE RELYING ON THEM.
 * Google changes these terms. Pages to check:
 *   - Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies
 *   - Maps Platform Terms: https://cloud.google.com/maps-platform/terms
 *   - Service specific terms: https://cloud.google.com/maps-platform/terms/maps-service-terms
 *   - Field masks / billing: https://developers.google.com/maps/documentation/places/web-service/choose-fields
 *   - Place IDs: https://developers.google.com/maps/documentation/places/web-service/place-id
 *
 * RULE 1 - FIELD MASK. Every request sends X-Goog-FieldMask with the smallest
 *   field set we use. Billing SKU depends on the fields requested. (Choose fields page.)
 *   Note: websiteUri and nationalPhoneNumber put requests in a higher SKU tier.
 * RULE 2 - STORE ONLY PLACE IDS. Place IDs are exempt from caching limits; all
 *   other content may not be pre-fetched, cached or stored outside what the
 *   terms allow. We store only place_id. Details are fetched live when an
 *   agency is opened. Optional in-memory cache is < 5 minutes, never on disk.
 *   (Policies page: "Pre-fetching, caching, or storage of content"; Place ID page.)
 * RULE 3 - NO BULK EXPORT. No CSV/download/"export all" of Google-derived data.
 *   Exports of your own notes reference place IDs only. (Terms: no scraping,
 *   no creating content from Google Maps Content / no bulk download.)
 * RULE 4 - ATTRIBUTION. Show "Google Maps" attribution wherever Google data is
 *   shown, plus any third-party attributions the API returns; never alter or
 *   obscure it; never show Google data on a non-Google map. (Policies page:
 *   "Display attributions"; Terms: no use with non-Google maps.)
 * RULE 5 - STALE IDS. Place IDs can expire. A NOT_FOUND response means the ID
 *   is stale/invalid: show "Listing no longer available" and offer to search
 *   again to relink. (Place ID page: "Refresh stored place IDs".)
 * ===========================================================================
 */

const BASE = 'https://places.googleapis.com/v1';

// RULE 1: the only fields we request. Text Search uses the "places." prefix.
const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'websiteUri',
  'nationalPhoneNumber', 'googleMapsUri', 'businessStatus',
];
const SEARCH_FIELD_MASK = DETAIL_FIELDS.map((f) => `places.${f}`).join(',');
const DETAILS_FIELD_MASK = DETAIL_FIELDS.join(',');

// Google place IDs are URL-safe base64-like strings.
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;

class PlacesError extends Error {
  constructor(code, message, httpStatus = 502) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// Untrusted input from Google: keep only expected fields, as plain strings.
function str(v, max = 500) {
  return typeof v === 'string' ? v.slice(0, max) : null;
}
function safeHttpUrl(v) {
  const s = str(v, 2000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
function normalizePlace(p) {
  if (!p || typeof p !== 'object') return null;
  const id = str(p.id, 300);
  if (!id || !PLACE_ID_RE.test(id)) return null;
  return {
    id,
    name: str(p.displayName && p.displayName.text),
    address: str(p.formattedAddress),
    website: safeHttpUrl(p.websiteUri),
    phone: str(p.nationalPhoneNumber, 50),
    mapsUrl: safeHttpUrl(p.googleMapsUri),
    businessStatus: str(p.businessStatus, 50),
    // RULE 4: pass through any attributions Google includes, unaltered.
    attributions: Array.isArray(p.attributions)
      ? p.attributions.map((a) => ({ provider: str(a && a.provider), providerUri: safeHttpUrl(a && a.providerUri) }))
        .filter((a) => a.provider)
      : [],
  };
}

function createPlacesClient({ apiKey, languageCode, regionCode, fetchImpl = globalThis.fetch, rateLimiter, cache }) {
  // Never let the key appear in an error message, even if Google echoes it.
  function redact(text) {
    const s = String(text || '').slice(0, 300);
    return apiKey ? s.split(apiKey).join('[redacted]') : s;
  }

  async function call(url, init) {
    if (!apiKey) throw new PlacesError('NO_KEY', 'Google search is off: GOOGLE_PLACES_API_KEY is not set in .env.', 503);
    rateLimiter.consume(); // throws PlacesError-compatible error when over limit
    let res;
    try {
      // Key goes in a header, never in the URL, so it cannot leak via URLs or logs.
      res = await fetchImpl(url, { ...init, headers: { ...init.headers, 'X-Goog-Api-Key': apiKey } });
    } catch {
      throw new PlacesError('NETWORK', 'Could not reach Google Places. Check your internet connection.');
    }
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) {
      const status = body && body.error && body.error.status;
      if (res.status === 404 || status === 'NOT_FOUND') {
        throw new PlacesError('NOT_FOUND', 'Listing no longer available.', 404);
      }
      const msg = body && body.error && body.error.message;
      throw new PlacesError(status || 'GOOGLE_ERROR', `Google Places error (${res.status}): ${redact(msg || 'unknown error')}`);
    }
    return body || {};
  }

  async function searchText(textQuery) {
    const body = await call(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': SEARCH_FIELD_MASK }, // RULE 1
      body: JSON.stringify({ textQuery, languageCode, regionCode, pageSize: 20 }),
    });
    const places = Array.isArray(body.places) ? body.places : [];
    return places.map(normalizePlace).filter(Boolean);
  }

  async function getDetails(placeId) {
    if (!PLACE_ID_RE.test(placeId)) throw new PlacesError('INVALID_ID', 'Invalid place ID.', 400);
    const cached = cache.get(placeId); // RULE 2: memory only, < 5 minutes
    if (cached) return cached;
    const body = await call(`${BASE}/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(languageCode)}`, {
      method: 'GET',
      headers: { 'X-Goog-FieldMask': DETAILS_FIELD_MASK }, // RULE 1
    });
    const place = normalizePlace(body);
    if (!place) throw new PlacesError('BAD_RESPONSE', 'Google returned an unexpected response.');
    cache.set(placeId, place);
    return place;
  }

  return { searchText, getDetails, enabled: Boolean(apiKey) };
}

module.exports = {
  createPlacesClient, PlacesError, PLACE_ID_RE, SEARCH_FIELD_MASK, DETAILS_FIELD_MASK, normalizePlace,
};
