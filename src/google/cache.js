'use strict';
// GOOGLE RULE 2 (see src/google/places.js): optional in-memory cache for live
// place details. Never written to disk. TTL is capped below 5 minutes and is
// 0 (disabled) by default. Re-verify the allowed caching period with Google.

const MAX_TTL_SECONDS = 299;

function createDetailsCache(ttlSeconds, now = () => Date.now()) {
  const ttl = Math.min(Math.max(ttlSeconds | 0, 0), MAX_TTL_SECONDS) * 1000;
  const map = new Map();
  return {
    get(key) {
      if (!ttl) return null;
      const hit = map.get(key);
      if (!hit) return null;
      if (now() - hit.at >= ttl) { map.delete(key); return null; }
      return hit.value;
    },
    set(key, value) {
      if (!ttl) return;
      map.set(key, { value, at: now() });
      // Purge expired entries so memory does not grow.
      for (const [k, v] of map) if (now() - v.at >= ttl) map.delete(k);
    },
    clear() { map.clear(); },
  };
}

module.exports = { createDetailsCache, MAX_TTL_SECONDS };
