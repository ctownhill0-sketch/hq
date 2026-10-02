'use strict';
// "Accept into my notes": copies ONE stored finding into YOUR qualification
// fields. The finding is read from the stored run (never from the browser),
// and only the whitelisted columns below can be written.
const { LIST_FIELDS } = require('./schema');

const WRITABLE = new Set([
  'handles_apartments', 'apartment_evidence_url', 'apartment_evidence_note',
  'decision_maker_name', 'decision_maker_title', 'current_system', 'problem_described', 'notes',
]);
const MAX = { apartment_evidence_note: 2000, current_system: 2000, problem_described: 4000, notes: 10000, decision_maker_name: 120, decision_maker_title: 120 };

// finding keys: "apartments", "leaders.N", "<list>.N"
function findingByKey(result, key) {
  if (key === 'apartments') return { kind: 'apartments', item: result.apartments };
  const m = /^([a-z_]+)\.(\d{1,3})$/.exec(key);
  if (!m) return null;
  const [, list, idx] = m;
  if (list !== 'leaders' && !LIST_FIELDS[list]) return null;
  const item = (result[list] || [])[Number(idx)];
  return item ? { kind: list, item } : null;
}

function appendText(current, line, max) {
  const next = current ? `${current}\n${line}` : line;
  return next.length > max ? next.slice(0, max) : next;
}

const cite = (f) => `"${f.quote}" (${f.source_url})`;

// Returns { updates } for the agencies table. Pure: no DB access.
function planAccept(agency, found, runDate) {
  const tag = `[AI research ${runDate}, verify]`;
  const u = {};
  const { kind, item } = found;
  if (kind === 'apartments') {
    if (item.verdict === 'yes') u.handles_apartments = 'yes';
    if (item.verdict === 'no') u.handles_apartments = 'no';
    const ev = item.evidence[0];
    if (ev) {
      u.apartment_evidence_url = ev.source_url;
      u.apartment_evidence_note = appendText(agency.apartment_evidence_note, `${tag} ${item.verdict}: ${cite(ev)}`, MAX.apartment_evidence_note);
    } else {
      u.apartment_evidence_note = appendText(agency.apartment_evidence_note, `${tag} ${item.verdict}: ${item.explanation}`, MAX.apartment_evidence_note);
    }
  } else if (kind === 'leaders') {
    u.decision_maker_name = item.name.slice(0, MAX.decision_maker_name);
    u.decision_maker_title = item.title.slice(0, MAX.decision_maker_title);
    u.notes = appendText(agency.notes, `${tag} Leader as published: ${item.name}, ${item.title} - ${item.source_url}`, MAX.notes);
  } else if (kind === 'technology') {
    u.current_system = appendText(agency.current_system, `${tag} ${item.label} - ${cite(item)}`, MAX.current_system);
  } else if (kind === 'pain_signals') {
    u.problem_described = appendText(agency.problem_described, `${tag} ${item.label} - ${cite(item)}`, MAX.problem_described);
  } else {
    u.notes = appendText(agency.notes, `${tag} ${LIST_FIELDS[kind]}: ${item.label} - ${cite(item)}`, MAX.notes);
  }
  for (const k of Object.keys(u)) if (!WRITABLE.has(k)) delete u[k]; // belt and braces
  return { updates: u };
}

module.exports = { findingByKey, planAccept, WRITABLE };
