-- ContractIQ — data model (PostgreSQL / Neon port of schema.sql)
-- Same tables and SECURITY invariants; Postgres dialect for production.
--   * SQLite INTEGER PRIMARY KEY  -> BIGINT GENERATED ALWAYS AS IDENTITY
--   * SQLite REAL                 -> DOUBLE PRECISION
--   * no PRAGMA; FKs/indexes are standard SQL
-- Keep in sync with schema.sql (dev/SQLite). The migration loader applies this.

CREATE TABLE IF NOT EXISTS employer (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  sector        TEXT,
  size_band     TEXT,
  ownership     TEXT,
  ticker        TEXT,
  is_seed       INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  website       TEXT,
  industry      TEXT,
  year_founded  INTEGER,
  locality      TEXT,
  region        TEXT,
  linkedin_url  TEXT,
  logo_url      TEXT,
  about         TEXT,
  provenance    TEXT
);

CREATE TABLE IF NOT EXISTS employer_alias (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employer_id  BIGINT NOT NULL REFERENCES employer(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  value        TEXT NOT NULL,
  UNIQUE (kind, value)
);
CREATE INDEX IF NOT EXISTS idx_employer_alias_employer ON employer_alias(employer_id);

CREATE TABLE IF NOT EXISTS benefit_plan (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employer_id         BIGINT NOT NULL REFERENCES employer(id) ON DELETE CASCADE,
  plan_type           TEXT NOT NULL,
  plan_year           INTEGER,
  source              TEXT NOT NULL,
  confidence          TEXT NOT NULL DEFAULT 'reported',
  plan_name           TEXT,
  plan_number         TEXT,
  sponsor_name_raw    TEXT,
  sponsor_ein         TEXT,
  sponsor_state       TEXT,
  pension_bnft_code   TEXT,
  welfare_bnft_code   TEXT,
  tot_participants    INTEGER,
  active_participants INTEGER,
  sch_h_attached      INTEGER,
  sch_r_attached      INTEGER,
  source_ref          TEXT UNIQUE,
  ingested_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_plan_employer ON benefit_plan(employer_id);
CREATE INDEX IF NOT EXISTS idx_plan_type ON benefit_plan(plan_type);
CREATE INDEX IF NOT EXISTS idx_plan_year ON benefit_plan(plan_year);

CREATE TABLE IF NOT EXISTS plan_terms (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employer_id      BIGINT NOT NULL REFERENCES employer(id) ON DELETE CASCADE,
  benefit_plan_id  BIGINT REFERENCES benefit_plan(id) ON DELETE SET NULL,
  term_key         TEXT NOT NULL,
  value_num        DOUBLE PRECISION,
  value_text       TEXT,
  unit             TEXT,
  plan_year        INTEGER,
  source           TEXT NOT NULL,
  confidence       TEXT NOT NULL DEFAULT 'reported',
  source_url       TEXT,
  source_snippet   TEXT,
  fetched_period   TEXT,
  notes            TEXT
);
CREATE INDEX IF NOT EXISTS idx_terms_employer ON plan_terms(employer_id);
CREATE INDEX IF NOT EXISTS idx_terms_plan ON plan_terms(benefit_plan_id);
CREATE INDEX IF NOT EXISTS idx_terms_key ON plan_terms(term_key);

-- Submission — no user_id, coarse period only (SECURITY §5).
CREATE TABLE IF NOT EXISTS submission (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employer_id        BIGINT NOT NULL REFERENCES employer(id) ON DELETE CASCADE,
  benefit_plan_id    BIGINT REFERENCES benefit_plan(id) ON DELETE SET NULL,
  plan_year          INTEGER,
  verification_tier  TEXT NOT NULL,
  submitted_period   TEXT
);
CREATE INDEX IF NOT EXISTS idx_submission_employer ON submission(employer_id);

CREATE TABLE IF NOT EXISTS valuation_profile (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label              TEXT,
  salary             DOUBLE PRECISION,
  family_status      TEXT,
  contribution_rate  DOUBLE PRECISION,
  health_usage_tier  TEXT,
  is_default         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingest_run (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source        TEXT NOT NULL,
  dataset       TEXT NOT NULL,
  plan_year     INTEGER,
  rows_scanned  INTEGER,
  rows_matched  INTEGER,
  plans_written INTEGER,
  started_at    TEXT,
  finished_at   TEXT
);

-- CompDatapoint — crowdsourced pay; no user_id, coarse period, tier/metro only.
CREATE TABLE IF NOT EXISTS comp_datapoint (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_family       TEXT NOT NULL,
  role_raw          TEXT,
  clearance_tier    TEXT NOT NULL,
  metro             TEXT NOT NULL,
  yoe_band          TEXT NOT NULL,
  employer_id       BIGINT REFERENCES employer(id) ON DELETE SET NULL,
  prime_sub         TEXT,
  customer_sector   TEXT,
  lcat              TEXT,
  base              DOUBLE PRECISION,
  bonus             DOUBLE PRECISION,
  total_cash        DOUBLE PRECISION,
  source            TEXT NOT NULL DEFAULT 'crowdsourced',
  confidence        TEXT NOT NULL DEFAULT 'reported',
  submitted_period  TEXT
);
CREATE INDEX IF NOT EXISTS idx_comp_cell ON comp_datapoint(role_family, clearance_tier, metro, yoe_band);
CREATE INDEX IF NOT EXISTS idx_comp_employer ON comp_datapoint(employer_id);
