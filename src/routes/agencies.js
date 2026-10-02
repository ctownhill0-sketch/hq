'use strict';
const express = require('express');
const { validate, parseId, ValidationError } = require('../validate');
const { PLACE_ID_RE } = require('../google/places');

const STAGES = ['researched', 'contacted', 'conversation', 'demo', 'proposal', 'paid_pilot', 'declined'];
const placeIdRule = { type: 'regex', re: PLACE_ID_RE, required: true, message: 'is not a valid Google place ID' };

// Fields you can edit on an agency. All of these are YOUR data.
const EDITABLE = {
  label: { type: 'text', max: 120 },
  pipeline_stage: { type: 'enum', values: STAGES },
  handles_apartments: { type: 'enum', values: ['yes', 'no', 'unknown'] },
  apartment_evidence_url: { type: 'url' },
  apartment_evidence_note: { type: 'text', max: 2000 },
  decision_maker_name: { type: 'text', max: 120 },
  decision_maker_title: { type: 'text', max: 120 },
  contact_route_note: { type: 'text', max: 2000 },
  current_system: { type: 'text', max: 2000 },
  problem_described: { type: 'text', max: 4000 },
  decline_reason: { type: 'text', max: 2000 },
  permission_to_use_sample: { type: 'bool' },
  notes: { type: 'text', max: 10000 },
};
const MANUAL = {
  manual_name: { type: 'text', max: 200, required: true },
  manual_website: { type: 'url' },
  manual_phone: { type: 'regex', re: /^[0-9+().\-\s x]{0,40}$/, message: 'may contain only digits, spaces and + ( ) - . x' },
};

function notFound() {
  const e = new Error('Agency not found.');
  e.httpStatus = 404;
  return e;
}

module.exports = function agencyRoutes({ db }) {
  const r = express.Router();

  // Name shown in lists is always your own data: manual name or your label.
  const LIST_SQL = `
    SELECT a.id, a.place_id, a.source, a.label, a.manual_name, a.pipeline_stage, a.handles_apartments, a.updated_at,
      (SELECT MIN(t.due_date) FROM tasks t WHERE t.agency_id = a.id AND t.status = 'open' AND t.due_date IS NOT NULL) AS next_follow_up,
      (SELECT MAX(c.contacted_at) FROM calls c WHERE c.agency_id = a.id) AS last_contact
    FROM agencies a
    ORDER BY (next_follow_up IS NULL), next_follow_up, a.updated_at DESC`;

  r.get('/agencies', (req, res) => {
    res.json({ agencies: db.prepare(LIST_SQL).all() });
  });

  // GOOGLE RULE 2: only the place ID is accepted and stored. Any other field
  // (name, address, phone...) is rejected by validate() as "not allowed".
  r.post('/agencies', (req, res, next) => {
    try {
      const { place_id } = validate(req.body, { place_id: placeIdRule });
      const existing = db.prepare('SELECT id FROM agencies WHERE place_id = ?').get(place_id);
      if (existing) return res.status(409).json({ error: 'Already saved.', id: existing.id });
      const info = db.prepare("INSERT INTO agencies (place_id, source) VALUES (?, 'google')").run(place_id);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) { next(e); }
  });

  // Agencies found by hand: you typed this data, so it is yours to store.
  r.post('/agencies/manual', (req, res, next) => {
    try {
      const input = validate(req.body, MANUAL);
      const info = db.prepare(
        "INSERT INTO agencies (source, manual_name, manual_website, manual_phone) VALUES ('manual', @manual_name, @manual_website, @manual_phone)"
      ).run({ manual_website: null, manual_phone: null, ...input });
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) { next(e); }
  });

  r.get('/agencies/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const agency = db.prepare('SELECT * FROM agencies WHERE id = ?').get(id);
      if (!agency) throw notFound();
      const calls = db.prepare(`
        SELECT c.*, d.current_process, d.bottleneck, d.volume_and_effort, d.existing_tools,
               d.approver_and_error_tolerance, d.purchase_authority
        FROM calls c LEFT JOIN discovery d ON d.call_id = c.id
        WHERE c.agency_id = ? ORDER BY c.contacted_at DESC, c.id DESC`).all(id);
      const tasks = db.prepare("SELECT * FROM tasks WHERE agency_id = ? ORDER BY status, due_date IS NULL, due_date").all(id);
      const demos = db.prepare('SELECT * FROM demos WHERE agency_id = ? ORDER BY scheduled_at DESC').all(id);
      res.json({ agency, calls, tasks, demos });
    } catch (e) { next(e); }
  });

  r.patch('/agencies/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const current = db.prepare('SELECT * FROM agencies WHERE id = ?').get(id);
      if (!current) throw notFound();
      const isManual = current.source !== 'google';
      const spec = isManual ? { ...EDITABLE, ...MANUAL } : EDITABLE;
      const input = validate(req.body, spec, { partial: true });
      const merged = { ...current, ...input };
      if (merged.pipeline_stage === 'declined' && !merged.decline_reason) {
        throw new ValidationError(['decline_reason: required when the stage is "declined"']);
      }
      const keys = Object.keys(input);
      if (!keys.length) return res.json({ ok: true });
      // Column names come from the fixed spec above, never from user input.
      db.prepare(`UPDATE agencies SET ${keys.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`)
        .run({ ...input, id });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // GOOGLE RULE 5: relink an agency whose place ID went stale.
  r.put('/agencies/:id/place', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const { place_id } = validate(req.body, { place_id: placeIdRule });
      const current = db.prepare('SELECT source FROM agencies WHERE id = ?').get(id);
      if (!current) throw notFound();
      if (current.source !== 'google') throw new ValidationError(['agency: only Google agencies can be relinked']);
      const clash = db.prepare('SELECT id FROM agencies WHERE place_id = ? AND id <> ?').get(place_id, id);
      if (clash) return res.status(409).json({ error: 'Another saved agency already uses that listing.', id: clash.id });
      db.prepare("UPDATE agencies SET place_id = ?, updated_at = datetime('now') WHERE id = ?").run(place_id, id);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.delete('/agencies/:id', (req, res, next) => {
    try {
      const info = db.prepare('DELETE FROM agencies WHERE id = ?').run(parseId(req.params.id));
      if (!info.changes) throw notFound();
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  return r;
};

module.exports.STAGES = STAGES;
