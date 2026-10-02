-- HQ Desk initial schema.
-- GOOGLE RULE 2: no column in this database holds Google-derived content
-- (names, addresses, phones, websites, ratings, reviews). For Google agencies
-- only place_id is stored. manual_* columns hold data YOU typed for agencies
-- found by hand, and are never filled from Google responses.

CREATE TABLE agencies (
  id INTEGER PRIMARY KEY,
  place_id TEXT UNIQUE,                       -- Google place ID (NULL for manual agencies)
  source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google','manual','sample')),
  manual_name TEXT,                           -- own data, manual/sample agencies only
  manual_website TEXT,
  manual_phone TEXT,
  label TEXT,                                 -- your own short label, typed by you (never filled from Google)
  pipeline_stage TEXT NOT NULL DEFAULT 'researched'
    CHECK (pipeline_stage IN ('researched','contacted','conversation','demo','proposal','paid_pilot','declined')),
  handles_apartments TEXT NOT NULL DEFAULT 'unknown' CHECK (handles_apartments IN ('yes','no','unknown')),
  apartment_evidence_url TEXT,
  apartment_evidence_note TEXT,
  decision_maker_name TEXT,
  decision_maker_title TEXT,
  contact_route_note TEXT,
  current_system TEXT,
  problem_described TEXT,
  decline_reason TEXT,
  permission_to_use_sample INTEGER NOT NULL DEFAULT 0 CHECK (permission_to_use_sample IN (0,1)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (source <> 'google' OR place_id IS NOT NULL),
  CHECK (source = 'google' OR manual_name IS NOT NULL)
);

CREATE TABLE calls (
  id INTEGER PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  contacted_at TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('call','email','other')),
  contact_person TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('no_answer','left_message','conversation','meeting_booked','not_interested','other')),
  notes TEXT,
  next_action TEXT,
  next_action_date TEXT
);
CREATE INDEX idx_calls_agency ON calls(agency_id);

CREATE TABLE discovery (
  id INTEGER PRIMARY KEY,
  call_id INTEGER NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
  current_process TEXT,
  bottleneck TEXT,
  volume_and_effort TEXT,
  existing_tools TEXT,
  approver_and_error_tolerance TEXT,
  purchase_authority TEXT
);

CREATE TABLE operators (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  firm TEXT,
  state TEXT,
  licence_verified INTEGER NOT NULL DEFAULT 0 CHECK (licence_verified IN (0,1)),
  licence_note TEXT,
  markets_and_appetite TEXT,
  carrier_wholesale_access TEXT,
  professional_capacity TEXT,
  turnaround TEXT,
  proposed_split_or_terms TEXT,
  eo_status TEXT,
  contact_info TEXT,
  stage TEXT NOT NULL DEFAULT 'to_contact'
    CHECK (stage IN ('to_contact','talked','interviewing','candidate','ruled_out')),
  notes TEXT
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  agency_id INTEGER REFERENCES agencies(id) ON DELETE CASCADE,
  operator_id INTEGER REFERENCES operators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tasks_due ON tasks(status, due_date);

CREATE TABLE demos (
  id INTEGER PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  notes TEXT,
  outcome TEXT
);

CREATE TABLE licensing_steps (
  id INTEGER PRIMARY KEY,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','done')),
  target_date TEXT,
  cost REAL,
  notes TEXT
);

CREATE TABLE ledger (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('signed_order','settled_receipt','fee','expense','reserve','tax_collected')),
  amount REAL NOT NULL,
  description TEXT,
  agency_id INTEGER REFERENCES agencies(id) ON DELETE SET NULL
);

CREATE TABLE weekly_log (
  id INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,
  hours_worked REAL,
  objections_heard TEXT,
  partner_status_note TEXT,
  notes TEXT
);

CREATE TABLE gates (
  id INTEGER PRIMARY KEY,
  gate_name TEXT NOT NULL UNIQUE,
  condition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_met' CHECK (status IN ('not_met','met')),
  evidence_note TEXT
);

-- Count of Google API calls per local day (your own usage data, not Google content).
CREATE TABLE api_usage (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0
);
