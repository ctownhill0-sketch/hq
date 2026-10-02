'use strict';
// "What changed" between two research results for the same agency.
const { LIST_FIELDS, norm } = require('./schema');

function keyed(list, keyFn) {
  return new Map(list.map((x) => [norm(keyFn(x)), x]));
}

function diffResults(prev, cur) {
  const changes = [];
  if (prev.fit.score !== cur.fit.score) {
    changes.push({ field: 'fit', text: `Fit score ${prev.fit.score} → ${cur.fit.score}` });
  }
  if (prev.apartments.verdict !== cur.apartments.verdict) {
    changes.push({ field: 'apartments', text: `Apartments: ${prev.apartments.verdict} → ${cur.apartments.verdict}` });
  }
  const lists = { ...LIST_FIELDS, leaders: 'Leaders' };
  for (const [k, label] of Object.entries(lists)) {
    const keyFn = k === 'leaders' ? (x) => `${x.name}|${x.title}` : (x) => x.label;
    const a = keyed(prev[k] || [], keyFn);
    const b = keyed(cur[k] || [], keyFn);
    const added = [...b.keys()].filter((x) => !a.has(x)).map((x) => (k === 'leaders' ? `${b.get(x).name} (${b.get(x).title})` : b.get(x).label));
    const removed = [...a.keys()].filter((x) => !b.has(x)).map((x) => (k === 'leaders' ? `${a.get(x).name} (${a.get(x).title})` : a.get(x).label));
    if (added.length || removed.length) changes.push({ field: k, label, added, removed });
  }
  return { changes, unchanged: changes.length === 0 };
}

module.exports = { diffResults };
