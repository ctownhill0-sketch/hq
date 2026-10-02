'use strict';
// Deep Research API. Input is only your confirmed URL; nothing from Google
// is accepted here or sent to the model.
const express = require('express');
const { validate, parseId, ValidationError } = require('../validate');
const { findingByKey, planAccept } = require('../research/accept');

function notFound(what) {
  return Object.assign(new Error(`${what} not found.`), { httpStatus: 404 });
}

function shapeRun(row, progress) {
  if (!row) return null;
  return {
    id: row.id, agency_id: row.agency_id, started_at: row.started_at, finished_at: row.finished_at,
    confirmed_url: row.confirmed_url, status: row.status, stage: row.stage, error: row.error,
    pages: row.pages_json ? JSON.parse(row.pages_json) : (progress ? progress.pages : []),
    model: row.model, input_tokens: row.input_tokens, output_tokens: row.output_tokens,
    cost_estimate_usd: row.cost_estimate_usd, cost_usd: row.cost_usd,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    rejected: row.rejected_json ? JSON.parse(row.rejected_json) : [],
    diff: row.diff_json ? JSON.parse(row.diff_json) : null,
    progress: progress || null,
  };
}

module.exports = function researchRoutes({ db, runner, config }) {
  const r = express.Router();
  const getRun = db.prepare('SELECT * FROM research_runs WHERE id = ?');
  const decisionsFor = db.prepare('SELECT finding_key, decision, applied_fields, decided_at FROM research_decisions WHERE run_id = ?');

  r.get('/research/status', (req, res) => {
    res.json({ research: runner.usage(), licenceLookupUrl: config.licenceLookupUrl });
  });

  r.get('/agencies/:id/research', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const agency = db.prepare('SELECT id, source, manual_website FROM agencies WHERE id = ?').get(id);
      if (!agency) throw notFound('Agency');
      const runs = db.prepare(`SELECT id, started_at, finished_at, status, stage, error, confirmed_url, model, input_tokens, output_tokens,
          cost_estimate_usd, cost_usd, json_extract(result_json, '$.fit.score') AS fit_score
        FROM research_runs WHERE agency_id = ? ORDER BY id DESC LIMIT 50`).all(id);
      const latestId = (runs.find((x) => x.status === 'succeeded') || runs[0] || {}).id;
      const latest = latestId ? shapeRun(getRun.get(latestId), runner.progressOf(latestId)) : null;
      res.json({
        runs,
        latest,
        decisions: latest ? decisionsFor.all(latest.id) : [],
        // Prefill: your last confirmed URL, else the website you typed yourself.
        suggested_url: (runs[0] && runs[0].confirmed_url) || agency.manual_website || null,
        usage: runner.usage(),
      });
    } catch (e) { next(e); }
  });

  r.get('/research/runs/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const row = getRun.get(id);
      if (!row) throw notFound('Research run');
      res.json({ run: shapeRun(row, runner.progressOf(id)), decisions: decisionsFor.all(id), usage: runner.usage() });
    } catch (e) { next(e); }
  });

  r.post('/agencies/:id/research', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!db.prepare('SELECT 1 FROM agencies WHERE id = ?').get(id)) throw notFound('Agency');
      // Only the confirmed URL is accepted: no names, addresses or other Google fields.
      const { confirmed_url } = validate(req.body, { confirmed_url: { type: 'url', required: true } });
      const started = runner.start(id, confirmed_url);
      res.status(202).json({ ...started, usage: runner.usage() });
    } catch (e) { next(e); }
  });

  r.post('/research/runs/:id/cancel', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      validate(req.body || {}, {});
      if (!runner.cancel(id)) return res.status(409).json({ error: 'That run is not in progress.' });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Accept / Dismiss / Wrong. Accept copies the stored finding into whitelisted fields.
  r.post('/research/runs/:id/decisions', (req, res, next) => {
    try {
      const runId = parseId(req.params.id);
      const input = validate(req.body, {
        finding_key: { type: 'regex', re: /^(apartments|[a-z_]{3,40}\.\d{1,3})$/, required: true, message: 'is not a finding key' },
        decision: { type: 'enum', values: ['accepted', 'dismissed', 'wrong', 'undecided'], required: true },
      });
      const run = getRun.get(runId);
      if (!run) throw notFound('Research run');
      if (run.status !== 'succeeded') throw new ValidationError(['run: only completed runs have findings']);
      const found = findingByKey(JSON.parse(run.result_json), input.finding_key);
      if (!found) throw notFound('Finding');

      const out = db.transaction(() => {
        if (input.decision === 'undecided') {
          db.prepare('DELETE FROM research_decisions WHERE run_id = ? AND finding_key = ?').run(runId, input.finding_key);
          return { applied: {} };
        }
        let applied = {};
        if (input.decision === 'accepted') {
          const agency = db.prepare('SELECT * FROM agencies WHERE id = ?').get(run.agency_id);
          applied = planAccept(agency, found, run.started_at.slice(0, 10)).updates;
          const keys = Object.keys(applied);
          if (keys.length) {
            // Column names come from the WRITABLE whitelist in research/accept.js.
            db.prepare(`UPDATE agencies SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`)
              .run({ ...applied, id: run.agency_id });
          }
          db.prepare("INSERT INTO agency_events (agency_id, kind, detail) VALUES (?, 'accept', ?)")
            .run(run.agency_id, `Accepted research finding into ${keys.map((k) => k.replace(/_/g, ' ')).join(', ') || 'notes'}`);
        }
        db.prepare(`INSERT INTO research_decisions (run_id, finding_key, decision, applied_fields) VALUES (?, ?, ?, ?)
          ON CONFLICT(run_id, finding_key) DO UPDATE SET decision = excluded.decision, applied_fields = excluded.applied_fields, decided_at = datetime('now','localtime')`)
          .run(runId, input.finding_key, input.decision, JSON.stringify(Object.keys(applied)));
        return { applied };
      })();
      res.json({ ok: true, applied_fields: Object.keys(out.applied) });
    } catch (e) { next(e); }
  });

  // You record that you checked the licence yourself (no automated lookup).
  r.put('/agencies/:id/licence', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const { verified } = validate(req.body, { verified: { type: 'bool', required: true } });
      const info = db.prepare("UPDATE agencies SET licence_verified = ?, licence_verified_at = CASE WHEN ? = 1 THEN datetime('now','localtime') ELSE NULL END, updated_at = datetime('now') WHERE id = ?")
        .run(verified, verified, id);
      if (!info.changes) throw notFound('Agency');
      db.prepare("INSERT INTO agency_events (agency_id, kind, detail) VALUES (?, 'licence', ?)")
        .run(id, verified ? 'Licence verified by you on the PA lookup' : 'Licence verification cleared');
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  return r;
};
