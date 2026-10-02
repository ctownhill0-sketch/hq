'use strict';
// Input validation. Every route declares exactly which fields it accepts;
// unknown fields are rejected, so nothing unexpected can reach the database.

class ValidationError extends Error {
  constructor(errors) {
    super('Invalid input: ' + errors.join('; '));
    this.code = 'VALIDATION';
    this.httpStatus = 400;
    this.errors = errors;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function validDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Remove control characters except tab/newline; trim.
function cleanText(s) {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

const rules = {
  text(v, o) {
    if (typeof v !== 'string') return [null, 'must be text'];
    const s = cleanText(v);
    if (s.length > (o.max || 2000)) return [null, `must be at most ${o.max || 2000} characters`];
    return [s === '' ? null : s];
  },
  enum(v, o) {
    return o.values.includes(v) ? [v] : [null, `must be one of: ${o.values.join(', ')}`];
  },
  date(v) {
    if (v === '') return [null];
    return typeof v === 'string' && validDate(v) ? [v] : [null, 'must be a date (YYYY-MM-DD)'];
  },
  datetime(v) {
    if (v === '') return [null];
    return typeof v === 'string' && DATETIME_RE.test(v) && validDate(v.slice(0, 10))
      ? [v.slice(0, 16)] : [null, 'must be a date and time (YYYY-MM-DDTHH:MM)'];
  },
  url(v) {
    if (v === '') return [null];
    if (typeof v !== 'string' || v.length > 2000) return [null, 'must be a URL'];
    try {
      const u = new URL(v.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return [null, 'must start with http:// or https://'];
      return [u.toString()];
    } catch {
      return [null, 'must be a valid URL (include https://)'];
    }
  },
  bool(v) {
    if (v === true || v === 1 || v === '1' || v === 'true') return [1];
    if (v === false || v === 0 || v === '0' || v === 'false') return [0];
    return [null, 'must be true or false'];
  },
  id(v) {
    const n = Number(v);
    return (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) && Number.isSafeInteger(n) && n > 0
      ? [n] : [null, 'must be a positive whole number'];
  },
  regex(v, o) {
    return typeof v === 'string' && o.re.test(v) ? [v.trim() === '' ? null : v.trim()] : [null, o.message || 'has an invalid format'];
  },
};

/**
 * validate(body, spec, { partial }) -> cleaned object
 * spec: { field: { type, required, max, values, re } }
 * partial=true allows missing fields (for PATCH); required still forbids empty.
 */
function validate(body, spec, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError(['body must be a JSON object']);
  const errors = [];
  for (const key of Object.keys(body)) {
    if (!Object.prototype.hasOwnProperty.call(spec, key)) errors.push(`${key}: field not allowed`);
  }
  const out = {};
  for (const [key, opts] of Object.entries(spec)) {
    const present = Object.prototype.hasOwnProperty.call(body, key) && body[key] !== null && body[key] !== undefined;
    if (!present) {
      if (opts.required && !partial) errors.push(`${key}: required`);
      else if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = null;
      continue;
    }
    const [value, err] = rules[opts.type](body[key], opts);
    if (err) errors.push(`${key}: ${err}`);
    else if (value === null && opts.required) errors.push(`${key}: required`);
    else out[key] = value;
  }
  if (errors.length) throw new ValidationError(errors);
  return out;
}

function parseId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER) throw new ValidationError(['id: must be a positive integer']);
  return n;
}

module.exports = { validate, parseId, ValidationError, validDate };
