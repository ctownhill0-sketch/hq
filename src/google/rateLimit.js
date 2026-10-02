'use strict';
// Server-side cap on Google calls, to control cost.
// - Per-minute: sliding window in memory.
// - Per-day: counter stored in SQLite (api_usage) so restarting the server
//   cannot reset today's cap. This is our own usage data, not Google content.

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.code = 'RATE_LIMITED';
    this.httpStatus = 429;
  }
}

function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function createRateLimiter({ db, perMinute, perDay, now = () => Date.now() }) {
  const recent = [];
  const getDay = db.prepare('SELECT calls FROM api_usage WHERE day = ?');
  const bump = db.prepare('INSERT INTO api_usage (day, calls) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET calls = calls + 1');

  function usedToday() {
    const row = getDay.get(localDay(new Date(now())));
    return row ? row.calls : 0;
  }

  function consume() {
    const t = now();
    while (recent.length && t - recent[0] >= 60_000) recent.shift();
    if (usedToday() >= perDay) {
      throw new RateLimitError(`Daily Google limit reached (${perDay} calls). It resets at midnight, or raise GOOGLE_RATE_LIMIT_PER_DAY in .env.`);
    }
    if (recent.length >= perMinute) {
      const wait = Math.ceil((60_000 - (t - recent[0])) / 1000);
      throw new RateLimitError(`Per-minute Google limit reached (${perMinute}/min). Try again in ${wait}s.`);
    }
    recent.push(t);
    bump.run(localDay(new Date(t)));
  }

  function status() {
    const t = now();
    while (recent.length && t - recent[0] >= 60_000) recent.shift();
    return { usedToday: usedToday(), perDay, usedThisMinute: recent.length, perMinute };
  }

  return { consume, status };
}

module.exports = { createRateLimiter, RateLimitError, localDay };
