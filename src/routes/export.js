'use strict';
// Export of YOUR OWN data only (notes, calls, tasks, demos).
// GOOGLE RULE 3: no Google-derived content is ever exported. Google agencies
// appear by place ID only; there is no export of search results or details.
const express = require('express');

module.exports = function exportRoutes({ db }) {
  const r = express.Router();
  r.get('/export/my-data.json', (req, res) => {
    const data = {
      exported_at: new Date().toISOString(),
      note: 'Your own HQ Desk records. Google agencies are referenced by place_id only.',
      agencies: db.prepare('SELECT * FROM agencies ORDER BY id').all(),
      calls: db.prepare('SELECT * FROM calls ORDER BY id').all(),
      discovery: db.prepare('SELECT * FROM discovery ORDER BY id').all(),
      tasks: db.prepare('SELECT * FROM tasks ORDER BY id').all(),
      demos: db.prepare('SELECT * FROM demos ORDER BY id').all(),
    };
    res.setHeader('Content-Disposition', 'attachment; filename="hq-desk-my-data.json"');
    res.json(data);
  });
  return r;
};
