'use strict';
// "Today" dashboard data and the per-agency activity timeline.
const express = require('express');
const { parseId } = require('../validate');

module.exports = function dashboardRoutes({ db }) {
  const r = express.Router();
  const nameSql = 'COALESCE(a.label, a.manual_name) AS agency_name, a.source AS agency_source';
  const today = "date('now','localtime')";

  r.get('/dashboard', (req, res) => {
    const taskBase = `SELECT t.*, ${nameSql} FROM tasks t LEFT JOIN agencies a ON a.id = t.agency_id WHERE t.status = 'open'`;
    const stages = db.prepare('SELECT pipeline_stage AS stage, COUNT(*) AS n FROM agencies GROUP BY pipeline_stage').all();
    const weekAgo = "datetime('now','localtime','-7 day')";
    res.json({
      overdue: db.prepare(`${taskBase} AND t.due_date < ${today} ORDER BY t.due_date LIMIT 50`).all(),
      today: db.prepare(`${taskBase} AND t.due_date = ${today} ORDER BY t.id LIMIT 50`).all(),
      upcoming: db.prepare(`${taskBase} AND t.due_date > ${today} AND t.due_date <= date('now','localtime','+7 day') ORDER BY t.due_date LIMIT 50`).all(),
      demos: db.prepare(`SELECT d.*, ${nameSql} FROM demos d JOIN agencies a ON a.id = d.agency_id
        WHERE d.scheduled_at >= strftime('%Y-%m-%dT%H:%M','now','localtime') ORDER BY d.scheduled_at LIMIT 20`).all(),
      pipeline: Object.fromEntries(stages.map((s) => [s.stage, s.n])),
      needs_research: db.prepare(`SELECT a.id, a.label, a.manual_name, a.source, a.pipeline_stage FROM agencies a
        WHERE a.pipeline_stage NOT IN ('declined','paid_pilot')
          AND NOT EXISTS (SELECT 1 FROM research_runs r WHERE r.agency_id = a.id AND r.status = 'succeeded')
        ORDER BY a.created_at DESC LIMIT 6`).all(),
      stats: {
        agencies: db.prepare('SELECT COUNT(*) n FROM agencies').get().n,
        calls_week: db.prepare(`SELECT COUNT(*) n FROM calls WHERE replace(contacted_at,'T',' ') >= ${weekAgo}`).get().n,
        conversations_week: db.prepare(`SELECT COUNT(DISTINCT agency_id) n FROM calls WHERE outcome IN ('conversation','meeting_booked') AND replace(contacted_at,'T',' ') >= ${weekAgo}`).get().n,
        open_tasks: db.prepare("SELECT COUNT(*) n FROM tasks WHERE status = 'open'").get().n,
      },
    });
  });

  r.get('/agencies/:id/timeline', (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const items = [
        ...db.prepare("SELECT replace(contacted_at,'T',' ') AS at, 'call' AS kind, channel || ': ' || outcome AS title, notes AS detail, id AS ref FROM calls WHERE agency_id = ?").all(id),
        ...db.prepare("SELECT datetime(created_at,'localtime') AS at, 'task' AS kind, 'Task added: ' || title AS title, due_date AS detail, id AS ref FROM tasks WHERE agency_id = ?").all(id),
        ...db.prepare("SELECT completed_at AS at, 'task_done' AS kind, 'Task done: ' || title AS title, NULL AS detail, id AS ref FROM tasks WHERE agency_id = ? AND completed_at IS NOT NULL").all(id),
        ...db.prepare("SELECT replace(scheduled_at,'T',' ') AS at, 'demo' AS kind, 'Demo scheduled' AS title, notes AS detail, id AS ref FROM demos WHERE agency_id = ?").all(id),
        ...db.prepare("SELECT at, kind, detail AS title, NULL AS detail, id AS ref FROM agency_events WHERE agency_id = ?").all(id),
        ...db.prepare("SELECT datetime(created_at,'localtime') AS at, 'created' AS kind, 'Agency saved' AS title, NULL AS detail, id AS ref FROM agencies WHERE id = ?").all(id),
      ].filter((x) => x.at).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 100);
      res.json({ items });
    } catch (e) { next(e); }
  });

  return r;
};
