-- Stage 1.5: Deep Research, activity timeline, licence check.
-- Times in this migration are LOCAL time (datetime('now','localtime')) for the timeline.
-- research_runs stores ONLY: your confirmed URL, URLs fetched from the agency's
-- own site, and findings derived from that site's text. Never Google data.

CREATE TABLE research_runs (
  id INTEGER PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  started_day TEXT NOT NULL DEFAULT (date('now','localtime')),
  finished_at TEXT,
  confirmed_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','cancelled')),
  stage TEXT,
  error TEXT,
  pages_json TEXT,              -- [{url, status, chars, note}] from the agency's own site
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_estimate_usd REAL,       -- worst case, computed before the run
  cost_usd REAL,                -- actual (or worst case if unknown, e.g. cancelled mid-call)
  result_json TEXT,             -- validated structured findings
  rejected_json TEXT,           -- findings dropped by validation (e.g. quote not on page)
  diff_json TEXT                -- what changed vs the previous successful run
);
CREATE INDEX idx_research_agency ON research_runs(agency_id, started_at);
CREATE INDEX idx_research_day ON research_runs(started_day);

CREATE TABLE research_decisions (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  finding_key TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('accepted','dismissed','wrong')),
  applied_fields TEXT,
  decided_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (run_id, finding_key)
);

CREATE TABLE agency_events (
  id INTEGER PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  kind TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX idx_events_agency ON agency_events(agency_id, at);

ALTER TABLE agencies ADD COLUMN licence_verified INTEGER NOT NULL DEFAULT 0 CHECK (licence_verified IN (0,1));
ALTER TABLE agencies ADD COLUMN licence_verified_at TEXT;
ALTER TABLE tasks ADD COLUMN completed_at TEXT;
