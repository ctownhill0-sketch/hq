'use strict';
// Fictional sample agencies so the app can be tried without any Google calls.
// They are clearly labelled fake, have no place IDs, and use reserved
// example.com websites and 555-01xx phone numbers.

const SAMPLES = [
  {
    manual_name: '[SAMPLE - FAKE] Keystone Habitational Partners',
    manual_website: 'https://keystone-sample.example.com',
    manual_phone: '(215) 555-0101',
    pipeline_stage: 'contacted',
    handles_apartments: 'yes',
    apartment_evidence_note: 'Fictional: website lists "apartment & multifamily programs".',
    decision_maker_name: 'Pat Example',
    decision_maker_title: 'Commercial Lines Manager',
    current_system: 'Fictional: spreadsheets + agency management system',
  },
  {
    manual_name: '[SAMPLE - FAKE] Three Rivers Property Insurance Group',
    manual_website: 'https://threerivers-sample.example.com',
    manual_phone: '(412) 555-0102',
    pipeline_stage: 'researched',
    handles_apartments: 'unknown',
  },
  {
    manual_name: '[SAMPLE - FAKE] Lehigh Valley Multifamily Brokers',
    manual_website: 'https://lehigh-sample.example.com',
    manual_phone: '(610) 555-0103',
    pipeline_stage: 'conversation',
    handles_apartments: 'yes',
    problem_described: 'Fictional: renewal prep for 40-unit buildings takes hours of re-keying.',
  },
];

function seedSampleAgencies(db) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM agencies WHERE source = 'sample'").get().n;
  if (existing > 0) return 0;
  const cols = ['manual_name', 'manual_website', 'manual_phone', 'pipeline_stage', 'handles_apartments',
    'apartment_evidence_note', 'decision_maker_name', 'decision_maker_title', 'current_system', 'problem_described'];
  const insert = db.prepare(
    `INSERT INTO agencies (source, ${cols.join(', ')}) VALUES ('sample', ${cols.map((c) => '@' + c).join(', ')})`
  );
  const addTask = db.prepare('INSERT INTO tasks (agency_id, title, due_date) VALUES (?, ?, date(\'now\', \'localtime\', ?))');
  db.transaction(() => {
    SAMPLES.forEach((s, i) => {
      const row = Object.fromEntries(cols.map((c) => [c, s[c] ?? null]));
      const id = insert.run(row).lastInsertRowid;
      // One overdue, one today, one upcoming task so the Follow-ups page has content.
      addTask.run(id, `Sample follow-up #${i + 1} (fake)`, `${i - 1} day`);
    });
  })();
  return SAMPLES.length;
}

module.exports = { seedSampleAgencies };
