'use strict';
// The ONLY shape of model output HQ Desk accepts, plus a strict validator.
// The schema sent to the API uses only supported keywords; length, count and
// range limits are enforced here, server-side, after the response arrives.
// Anything off-schema rejects the whole result. Individual findings whose
// quote cannot be found on the cited page are dropped (and listed as rejected).

const RUBRIC = {
  apartment_evidence: { max: 30, label: 'Apartment / habitational evidence' },
  independence: { max: 20, label: 'Independent agency' },
  size_fit: { max: 15, label: 'Size fit for a $1,500 pilot' },
  bottleneck_signal: { max: 20, label: 'Renewal / document bottleneck signal' },
  reachable_decision_maker: { max: 15, label: 'Reachable decision maker' },
};

const LIST_FIELDS = {
  niches_and_lines: 'Other niches and commercial lines served',
  markets_carriers_wholesalers: 'Markets, carriers and wholesalers mentioned',
  team_size_signals: 'Team size signals',
  technology: 'Agency management system or tech mentioned',
  pain_signals: 'Renewal / document / process pain signals',
  red_flags: 'Red flags',
};

const finding = {
  type: 'object',
  properties: {
    label: { type: 'string', description: 'Short finding in your own words (max 20 words).' },
    source_url: { type: 'string', description: 'Exact source_url of the page the quote is copied from.' },
    quote: { type: 'string', description: 'Verbatim quote copied from that page, max 25 words.' },
  },
  required: ['label', 'source_url', 'quote'],
  additionalProperties: false,
};
const leader = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    title: { type: 'string', description: 'Title exactly as published on the site.' },
    source_url: { type: 'string' },
    quote: { type: 'string', description: 'Verbatim quote (max 25 words) showing the name and title.' },
  },
  required: ['name', 'title', 'source_url', 'quote'],
  additionalProperties: false,
};
const rubricItem = {
  type: 'object',
  properties: { score: { type: 'integer' }, reason: { type: 'string' } },
  required: ['score', 'reason'],
  additionalProperties: false,
};

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    apartments: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['yes', 'likely', 'no', 'not_found'] },
        explanation: { type: 'string' },
        evidence: { type: 'array', items: finding },
      },
      required: ['verdict', 'explanation', 'evidence'],
      additionalProperties: false,
    },
    ...Object.fromEntries(Object.keys(LIST_FIELDS).map((k) => [k, { type: 'array', items: finding }])),
    leaders: { type: 'array', items: leader },
    unknowns: { type: 'array', items: { type: 'string' } },
    fit: {
      type: 'object',
      properties: {
        rubric: {
          type: 'object',
          properties: Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, rubricItem])),
          required: Object.keys(RUBRIC),
          additionalProperties: false,
        },
        low_confidence: { type: 'boolean' },
        why: { type: 'string' },
      },
      required: ['rubric', 'low_confidence', 'why'],
      additionalProperties: false,
    },
    discovery_questions: { type: 'array', items: { type: 'string' } },
    personalization_lines: { type: 'array', items: { type: 'string' } },
  },
  required: ['apartments', ...Object.keys(LIST_FIELDS), 'leaders', 'unknowns', 'fit', 'discovery_questions', 'personalization_lines'],
  additionalProperties: false,
};

class SchemaError extends Error {
  constructor(errors) {
    super('Model output did not match the required schema: ' + errors.slice(0, 5).join('; '));
    this.code = 'OFF_SCHEMA';
    this.errors = errors;
  }
}

// Generic strict validator for the subset of JSON Schema used above.
function check(value, schema, path, errors) {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return errors.push(`${path}: must be an object`);
    for (const k of Object.keys(value)) if (!schema.properties[k]) errors.push(`${path}.${k}: unexpected field`);
    for (const k of schema.required) if (!(k in value)) errors.push(`${path}.${k}: missing`);
    for (const [k, sub] of Object.entries(schema.properties)) if (k in value) check(value[k], sub, `${path}.${k}`, errors);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return errors.push(`${path}: must be an array`);
    value.forEach((v, i) => check(v, schema.items, `${path}[${i}]`, errors));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return errors.push(`${path}: must be a string`);
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not an allowed value`);
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) errors.push(`${path}: must be an integer`);
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${path}: must be true/false`);
  }
  return errors;
}

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

// Normalise text for quote matching: case, whitespace, quote marks, dashes.
function norm(s) {
  return String(s).toLowerCase()
    .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"')
    .replace(/[‐-―]/g, '-').replace(/…/g, '...')
    .replace(/\s+/g, ' ').trim();
}

/**
 * validateResult(raw, pages) -> { result, rejected }
 * raw: parsed JSON from the model. pages: [{ url, text }] actually fetched.
 * Throws SchemaError if off-schema.
 */
function validateResult(raw, pages) {
  const errors = check(raw, OUTPUT_SCHEMA, '$', []);
  if (errors.length) throw new SchemaError(errors);

  // Server-side limits the API schema cannot express.
  const limit = (s, max, p) => { if (s.length > max) errors.push(`${p}: longer than ${max} characters`); };
  const lists = ['niches_and_lines', 'markets_carriers_wholesalers', 'team_size_signals', 'technology', 'pain_signals', 'red_flags'];
  for (const k of lists) if (raw[k].length > 12) errors.push(`${k}: more than 12 items`);
  if (raw.apartments.evidence.length > 6) errors.push('apartments.evidence: more than 6 items');
  if (raw.leaders.length > 12) errors.push('leaders: more than 12 items');
  if (raw.unknowns.length > 10) errors.push('unknowns: more than 10 items');
  if (raw.discovery_questions.length !== 5) errors.push('discovery_questions: must have exactly 5');
  if (raw.personalization_lines.length < 2 || raw.personalization_lines.length > 3) errors.push('personalization_lines: must have 2-3');
  limit(raw.apartments.explanation, 600, 'apartments.explanation');
  limit(raw.fit.why, 800, 'fit.why');
  raw.unknowns.forEach((s, i) => limit(s, 300, `unknowns[${i}]`));
  raw.discovery_questions.forEach((s, i) => limit(s, 300, `discovery_questions[${i}]`));
  raw.personalization_lines.forEach((s, i) => limit(s, 300, `personalization_lines[${i}]`));
  for (const [k, { max }] of Object.entries(RUBRIC)) {
    const r = raw.fit.rubric[k];
    if (r.score < 0 || r.score > max) errors.push(`fit.rubric.${k}.score: must be 0-${max}`);
    limit(r.reason, 400, `fit.rubric.${k}.reason`);
  }
  if (errors.length) throw new SchemaError(errors);

  // Evidence check: each quote must appear on the page it cites.
  const pageText = new Map(pages.map((p) => [p.url, norm(p.text)]));
  const rejected = [];
  function verify(item, where) {
    const problems = [];
    if (!pageText.has(item.source_url)) problems.push('cites a page that was not fetched');
    if (words(item.quote) > 25) problems.push('quote longer than 25 words');
    if (!item.quote.trim()) problems.push('empty quote');
    else if (pageText.has(item.source_url) && !pageText.get(item.source_url).includes(norm(item.quote))) {
      problems.push('quote not found on the cited page');
    }
    for (const [f, max] of [['label', 200], ['name', 120], ['title', 160], ['quote', 400]]) {
      if (typeof item[f] === 'string' && item[f].length > max) problems.push(`${f} too long`);
    }
    if (problems.length) { rejected.push({ where, ...item, reasons: problems }); return false; }
    return true;
  }

  const result = {
    apartments: {
      verdict: raw.apartments.verdict,
      explanation: raw.apartments.explanation,
      evidence: raw.apartments.evidence.filter((e, i) => verify(e, `apartments.evidence[${i}]`)),
    },
    leaders: raw.leaders.filter((l, i) => verify(l, `leaders[${i}]`)),
    unknowns: raw.unknowns,
    discovery_questions: raw.discovery_questions,
    personalization_lines: raw.personalization_lines,
  };
  for (const k of lists) result[k] = raw[k].filter((e, i) => verify(e, `${k}[${i}]`));
  // Never claim "yes/likely" without surviving evidence.
  if (['yes', 'likely'].includes(result.apartments.verdict) && !result.apartments.evidence.length) {
    result.apartments.verdict = 'not_found';
    result.apartments.explanation = `(Downgraded: no verifiable quote supported "${raw.apartments.verdict}".) ${result.apartments.explanation}`.slice(0, 700);
  }
  // Score is recomputed from the rubric so it is always transparent.
  const rubric = Object.fromEntries(Object.entries(RUBRIC).map(([k, { max, label }]) => [k, { ...raw.fit.rubric[k], max, label }]));
  const score = Object.values(rubric).reduce((sum, r) => sum + r.score, 0);
  const evidenceCount = result.apartments.evidence.length + lists.reduce((n, k) => n + result[k].length, 0) + result.leaders.length;
  const lowConfidence = raw.fit.low_confidence || evidenceCount < 3 || pages.length < 2;
  result.fit = { score, rubric, why: raw.fit.why, low_confidence: lowConfidence };
  return { result, rejected };
}

module.exports = { OUTPUT_SCHEMA, RUBRIC, LIST_FIELDS, validateResult, SchemaError, norm };
