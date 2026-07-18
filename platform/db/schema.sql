-- ContractIQ — data model
-- Implements docs/STRATEGY.md §5 and upholds docs/SECURITY.md as hard constraints.
--
-- Written in portable SQL (SQLite dialect now; migrates to Postgres later).
-- SQLite specifics kept minimal: INTEGER PRIMARY KEY, TEXT/REAL, CHECK, no vendor types.
--
-- SECURITY invariants encoded here (see docs/SECURITY.md):
--   * `submission` has NO user_id / account back-reference (§5.1) — the
--     person->submission link must not exist in the schema.
--   * `submission` stores only a COARSE period, never a precise timestamp (§5.3).
--   * No column anywhere holds a real name, email, SSN, IP, or clearance id (§2).
--   * Employer identity is public/company-level and carries no personal data.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Employer — a company/institution people compare offers between.
-- Public, company-level data only. Seeded from the curated list + Form 5500.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,          -- stable key, e.g. 'lockheed-martin'
  display_name  TEXT NOT NULL,                 -- 'Lockheed Martin'
  sector        TEXT,                          -- prime | integrator | ffrdc | tech | sub | services
  size_band     TEXT,                          -- optional: enterprise | large | mid
  ownership     TEXT,                          -- public | private | nonprofit
  ticker        TEXT,                          -- public co. ticker if any (LMT, NOC, ...)
  is_seed       INTEGER NOT NULL DEFAULT 0,    -- 1 = part of the curated launch set
  notes         TEXT
);

-- Alternate names / EINs used to attribute raw filings to an employer.
-- (Filings come in under subsidiaries and messy legal names.)
CREATE TABLE IF NOT EXISTS employer_alias (
  id           INTEGER PRIMARY KEY,
  employer_id  INTEGER NOT NULL REFERENCES employer(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                  -- name_prefix | ein
  value        TEXT NOT NULL,                  -- normalized alias or 9-digit EIN
  UNIQUE (kind, value)
);
CREATE INDEX IF NOT EXISTS idx_employer_alias_employer ON employer_alias(employer_id);

-- ---------------------------------------------------------------------------
-- BenefitPlan — one benefit plan belonging to an employer (STRATEGY §5).
-- For the Form 5500 seed, one row == one 5500 filing (identified by ack_id).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS benefit_plan (
  id                  INTEGER PRIMARY KEY,
  employer_id         INTEGER NOT NULL REFERENCES employer(id) ON DELETE CASCADE,

  plan_type           TEXT NOT NULL,           -- db_pension | 401k | dc_other | esop |
                                               -- health_welfare | life | disability |
                                               -- dental_vision | severance | other
  plan_year           INTEGER,                 -- e.g. 2023
  source              TEXT NOT NULL,           -- form5500 | sec | union | crowdsourced | employer
  confidence          TEXT NOT NULL DEFAULT 'reported', -- verified | reported | inferred

  plan_name           TEXT,
  plan_number         TEXT,                    -- SPONS_DFE_PN
  sponsor_name_raw    TEXT,                    -- as filed (company-level, not personal)
  sponsor_ein         TEXT,                    -- employer EIN (company-level id, public)
  sponsor_state       TEXT,

  -- raw Form 5500 classification codes, kept verbatim so nothing is lost
  pension_bnft_code   TEXT,
  welfare_bnft_code   TEXT,

  tot_participants    INTEGER,
  active_participants INTEGER,
  sch_h_attached      INTEGER,                 -- large-plan financials available
  sch_r_attached      INTEGER,                 -- retirement-plan schedule available

  -- provenance / dedup for public-filing sources
  source_ref          TEXT UNIQUE,             -- e.g. Form 5500 ACK_ID
  ingested_at         TEXT                     -- ISO date of ingest (system, not user)
);
CREATE INDEX IF NOT EXISTS idx_plan_employer ON benefit_plan(employer_id);
CREATE INDEX IF NOT EXISTS idx_plan_type ON benefit_plan(plan_type);
CREATE INDEX IF NOT EXISTS idx_plan_year ON benefit_plan(plan_year);

-- ---------------------------------------------------------------------------
-- PlanTerms — the priced parameters for a plan (STRATEGY §5), polymorphic by
-- plan_type. Stored as typed key/value so any plan type's terms fit one table.
-- Empty from the Form 5500 seed (5500 proves a plan EXISTS, not its exact terms);
-- populated later by SEC filings, union CBAs, and crowdsourced submissions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_terms (
  id               INTEGER PRIMARY KEY,
  employer_id      INTEGER NOT NULL REFERENCES employer(id) ON DELETE CASCADE,
  benefit_plan_id  INTEGER REFERENCES benefit_plan(id) ON DELETE SET NULL, -- optional link to a specific 5500 plan
  term_key         TEXT NOT NULL,              -- e.g. 'k401_match' | 'hsa_employer' | 'pto' | 'schedule_9_80'
  value_num        REAL,                       -- headline numeric value when applicable
  value_text       TEXT,                       -- structured text (e.g. "100% of first 6%")
  unit             TEXT,                       -- 'pct' | 'usd_per_year' | 'days' | 'weeks' | 'bool' | ...
  plan_year        INTEGER,
  source           TEXT NOT NULL,              -- form5500 | sec | union | crowdsourced | employer | employer_web
  confidence       TEXT NOT NULL DEFAULT 'reported', -- verified | reported | inferred
  -- provenance (critical for web-extracted / documented terms; see STRATEGY §3)
  source_url       TEXT,                       -- where the value was read
  source_snippet   TEXT,                       -- verbatim supporting text
  fetched_period   TEXT,                       -- coarse fetch date, e.g. '2026-07'
  notes            TEXT
);
CREATE INDEX IF NOT EXISTS idx_terms_employer ON plan_terms(employer_id);
CREATE INDEX IF NOT EXISTS idx_terms_plan ON plan_terms(benefit_plan_id);
CREATE INDEX IF NOT EXISTS idx_terms_key ON plan_terms(term_key);

-- ---------------------------------------------------------------------------
-- Submission — provenance for CROWDSOURCED data (STRATEGY §5, SECURITY §5).
-- CRITICAL: no user_id / account back-reference (SECURITY §5.1). The account
-- gates the ACT of submitting elsewhere; it never OWNS the row. Timestamp is
-- coarse only (SECURITY §5.3). Not populated by the Form 5500 seed — defined
-- here so the model is complete and the constraint is enforced from day one.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submission (
  id                 INTEGER PRIMARY KEY,
  employer_id        INTEGER NOT NULL REFERENCES employer(id) ON DELETE CASCADE,
  benefit_plan_id    INTEGER REFERENCES benefit_plan(id) ON DELETE SET NULL,
  plan_year          INTEGER,
  verification_tier  TEXT NOT NULL,            -- doc_verified | email_domain | unverified
  submitted_period   TEXT                      -- COARSE only, e.g. '2026-07' (never precise ts)
  -- INTENTIONALLY ABSENT: user_id, account_id, email, ip, precise timestamp.
);
CREATE INDEX IF NOT EXISTS idx_submission_employer ON submission(employer_id);

-- ---------------------------------------------------------------------------
-- ValuationProfile — the user assumptions that drive personalized dollar values
-- (STRATEGY §5). Assumption set only; carries no identity. Held client-side in
-- production; table exists so the valuation engine has a defined shape to read.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS valuation_profile (
  id                 INTEGER PRIMARY KEY,
  label              TEXT,                      -- e.g. 'baseline-single', 'baseline-family'
  salary             REAL,
  family_status      TEXT,                      -- single | family
  contribution_rate  REAL,                      -- fraction of salary, e.g. 0.10
  health_usage_tier  TEXT,                      -- low | medium | high
  is_default         INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- ingest_run — operational log of pipeline runs (system metadata, no PII).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_run (
  id            INTEGER PRIMARY KEY,
  source        TEXT NOT NULL,                 -- form5500
  dataset       TEXT NOT NULL,                 -- e.g. 'F_5500_2023'
  plan_year     INTEGER,
  rows_scanned  INTEGER,
  rows_matched  INTEGER,
  plans_written INTEGER,
  started_at    TEXT,
  finished_at   TEXT
);
