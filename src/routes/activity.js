'use strict';
// Calls (with the six discovery questions), tasks and demos.
const express = require('express');
const { validate, parseId, ValidationError } = require('../validate');

const CALL = {
  contacted_at: { type: 'datetime', required: true },
  channel: { type: 'enum', values: ['call', 'email', 'other'], required: true },
  contact_person: { type: 'text', max: 120 },
  outcome: { type: 'enum', values: ['no_answer', 'left_message', 'conversation', 'meeting_booked', 'not_interested', 'other'], required: true },
  notes: { type: 'text', max: 10000 },
  next_action: { type: 'text', max: 300 },
  next_action_date: { type: 'date' },
};
const DISCOVERY = {
  current_process: { type: 'text', max: 4000 },
  bottleneck: { type: 'text', max: 4000 },
  volume_and_effort: { type: 'text', max: 4000 },
  existing_tools: { type: 'text', max: 4000 },
  approver_and_error_tolerance: { type: 'text', max: 4000 },
  purchase_authority: { type: 'text', max: 4000 },
};
const TASK = {
  agency_id: { type: 'id' },
  title: { type: 'text', max: 300, required: true },
  due_date: { type: 'date' },
};
const TASK_PATCH = {
  title: { type: 'text', max: 300, required: true },
  due_date: { type: 'date' },
  status: { type: 'enum', values: ['open', 'done'] },
};
const DEMO = {
  scheduled_at: { type: 'datetime', required: true },
  notes: { type: 'text', max: 4000 },
  outcome: { type: 'text', max: 2000 },
};

function localNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function notFound(what) {
  const e = new Error(`${what} not found.`);
  e.httpStatus = 404;
  return e;
}

function updateRow(db, table, id, input) {
  const keys = Object.keys(input);
  if (!keys.length) return 1;
  // Column names come from the fixed specs above, never from user input.
  return db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...input, id }).changes;
}

module.exports = function activityRoutes({ db }) {
  const r = express.Router();
  const agencyExists = (id) => Boolean(db.prepare('SELECT 1 FROM agencies WHERE id = ?').get(id));
  const touch = db.prepare("UPDATE agencies SET updated_at = datetime('now') WHERE id = ?");

  // ---- Calls -------------------------------------------------------------
  r.post('/agencies/:id/calls', (req, res, next) => {
    try {
      const agencyId = parseId(req.params.id);
      if (!agencyExists(agencyId)) throw notFound('Agency');
      const body = req.body || {};
      const { discovery, ...callBody } = body;
      const call = validate(callBody, CALL);
      const disc = validate(discovery || {}, DISCOVERY);
      if (call.next_action_date && !call.next_action) {
        throw new ValidationError(['next_action: describe the next action when you set a date']);
      }
      const result = db.transaction(() => {
        const callId = db.prepare(`INSERT INTO calls (agency_id, contacted_at, channel, contact_person, outcome, notes, next_action, next_action_date)
          VALUES (@agency_id, @contacted_at, @channel, @contact_person, @outcome, @notes, @next_action, @next_action_date)`)
          .run({ contact_person: null, notes: null, next_action: null, next_action_date: null, ...call, agency_id: agencyId }).lastInsertRowid;
        if (Object.values(disc).some((v) => v)) {
          db.prepare(`INSERT INTO discovery (call_id, current_process, bottleneck, volume_and_effort, existing_tools, approver_and_error_tolerance, purchase_authority)
            VALUES (@call_id, @current_process, @bottleneck, @volume_and_effort, @existing_tools, @approver_and_error_tolerance, @purchase_authority)`)
            .run({ ...Object.fromEntries(Object.keys(DISCOVERY).map((k) => [k, null])), ...disc, call_id: callId });
        }
        // A next action becomes a task so it shows up on the Follow-ups page.
        let taskId = null;
        if (call.next_action) {
          taskId = db.prepare('INSERT INTO tasks (agency_id, title, due_date) VALUES (?, ?, ?)')
            .run(agencyId, call.next_action, call.next_action_date || null).lastInsertRowid;
        }
        touch.run(agencyId);
        return { id: callId, task_id: taskId };
      })();
      res.status(201).json(result);
    } catch (e) { next(e); }
  });

  r.delete('/calls/:id', (req, res, next) => {
    try {
      if (!db.prepare('DELETE FROM calls WHERE id = ?').run(parseId(req.params.id)).changes) throw notFound('Call');
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // ---- Tasks -------------------------------------------------------------
  r.post('/tasks', (req, res, next) => {
    try {
      const input = validate(req.body, TASK);
      const agencyId = input.agency_id || null;
      if (agencyId && !agencyExists(agencyId)) throw notFound('Agency');
      const info = db.prepare('INSERT INTO tasks (agency_id, title, due_date) VALUES (?, ?, ?)')
        .run(agencyId, input.title, input.due_date || null);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) { next(e); }
  });

  r.patch('/tasks/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const input = validate(req.body, TASK_PATCH, { partial: true });
      if (input.status) input.completed_at = input.status === 'done' ? localNow() : null;
      if (!updateRow(db, 'tasks', id, input)) throw notFound('Task');
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.delete('/tasks/:id', (req, res, next) => {
    try {
      if (!db.prepare('DELETE FROM tasks WHERE id = ?').run(parseId(req.params.id)).changes) throw notFound('Task');
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // ---- Demos -------------------------------------------------------------
  r.post('/agencies/:id/demos', (req, res, next) => {
    try {
      const agencyId = parseId(req.params.id);
      if (!agencyExists(agencyId)) throw notFound('Agency');
      const input = validate(req.body, DEMO);
      const info = db.prepare('INSERT INTO demos (agency_id, scheduled_at, notes, outcome) VALUES (?, ?, ?, ?)')
        .run(agencyId, input.scheduled_at, input.notes || null, input.outcome || null);
      touch.run(agencyId);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (e) { next(e); }
  });

  r.patch('/demos/:id', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!updateRow(db, 'demos', id, validate(req.body, DEMO, { partial: true }))) throw notFound('Demo');
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.delete('/demos/:id', (req, res, next) => {
    try {
      if (!db.prepare('DELETE FROM demos WHERE id = ?').run(parseId(req.params.id)).changes) throw notFound('Demo');
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // ---- Follow-ups ----------------------------------------------------------
  r.get('/followups', (req, res) => {
    // Dates are compared in the laptop's local time.
    const nameSql = "COALESCE(a.label, a.manual_name) AS agency_name, a.source AS agency_source";
    const base = `SELECT t.*, ${nameSql} FROM tasks t LEFT JOIN agencies a ON a.id = t.agency_id WHERE t.status = 'open'`;
    const today = "date('now','localtime')";
    res.json({
      today: db.prepare(`${base} AND t.due_date = ${today} ORDER BY t.id`).all(),
      overdue: db.prepare(`${base} AND t.due_date < ${today} ORDER BY t.due_date`).all(),
      upcoming: db.prepare(`${base} AND t.due_date > ${today} AND t.due_date <= date('now','localtime','+7 day') ORDER BY t.due_date`).all(),
      undated: db.prepare(`${base} AND t.due_date IS NULL ORDER BY t.id DESC`).all(),
      demos: db.prepare(`SELECT d.*, ${nameSql} FROM demos d JOIN agencies a ON a.id = d.agency_id
        WHERE d.scheduled_at >= strftime('%Y-%m-%dT%H:%M', 'now', 'localtime') ORDER BY d.scheduled_at`).all(),
    });
  });

  return r;
};
