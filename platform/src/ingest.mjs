// Ingest Form 5500 filings -> employer + benefit_plan rows for the seed set.
//
// Streams the (large) CSV, attributes each filing to a curated employer by
// EIN or normalized sponsor-name prefix, classifies the plan from its benefit
// codes, and upserts. Form 5500 proves a plan EXISTS and its scale; it does NOT
// carry the priced terms (match %, HSA $, PTO) — those come later from SEC
// filings, union CBAs, and crowdsourced submissions (STRATEGY.md §4).
//
// Usage: node src/ingest.mjs [year ...]   (default year: 2023)

import { readFileSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'csv-parse';

import { openDb } from './lib/db.mjs';
import { getDatasetCsv } from './lib/efast.mjs';
import { buildMatcher, normalizeName } from './lib/normalize.mjs';
import { classifyPlan } from './lib/benefit-codes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', 'data', 'employers.seed.json');

const years = process.argv.slice(2).map(Number).filter(Boolean);
const YEARS = years.length ? years : [2023];

const toInt = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};
const yearOf = (dateStr, fallback) => {
  const m = String(dateStr || '').match(/(\d{4})/);
  return m ? Number(m[1]) : fallback;
};

function loadEmployers(db) {
  const { employers } = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  const upsertEmp = db.prepare(`
    INSERT INTO employer (slug, display_name, sector, ownership, ticker, is_seed)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(slug) DO UPDATE SET
      display_name = excluded.display_name, sector = excluded.sector,
      ownership = excluded.ownership, ticker = excluded.ticker, is_seed = 1
  `);
  const getId = db.prepare('SELECT id FROM employer WHERE slug = ?');
  const insAlias = db.prepare(`
    INSERT INTO employer_alias (employer_id, kind, value) VALUES (?, ?, ?)
    ON CONFLICT(kind, value) DO NOTHING
  `);
  const idBySlug = new Map();
  for (const e of employers) {
    upsertEmp.run(e.slug, e.display_name, e.sector ?? null, e.ownership ?? null, e.ticker ?? null);
    const id = getId.get(e.slug).id;
    idBySlug.set(e.slug, id);
    for (const m of e.match || []) insAlias.run(id, 'name_prefix', normalizeName(m));
    for (const ein of e.ein || []) insAlias.run(id, 'ein', String(ein).replace(/\D/g, ''));
  }
  return { employers, idBySlug };
}

async function ingestYear(db, year, matcher, idBySlug) {
  console.log(`\n== Form 5500 ${year} ==`);
  const csvPath = await getDatasetCsv('F_5500', year);

  const insPlan = db.prepare(`
    INSERT INTO benefit_plan (
      employer_id, plan_type, plan_year, source, confidence,
      plan_name, plan_number, sponsor_name_raw, sponsor_ein, sponsor_state,
      pension_bnft_code, welfare_bnft_code, tot_participants, active_participants,
      sch_h_attached, sch_r_attached, source_ref, ingested_at
    ) VALUES (?, ?, ?, 'form5500', 'reported', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_ref) DO NOTHING
  `);
  const today = new Date().toISOString().slice(0, 10);

  let scanned = 0, matched = 0, written = 0;
  db.exec('BEGIN');
  const parser = createReadStream(csvPath).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }),
  );
  for await (const row of parser) {
    scanned++;
    const emp =
      matcher.matchEin(row.SPONS_DFE_EIN) ||
      matcher.matchName(normalizeName(row.SPONSOR_DFE_NAME));
    if (!emp) continue;
    matched++;
    const { planType } = classifyPlan(row.TYPE_PENSION_BNFT_CODE, row.TYPE_WELFARE_BNFT_CODE);
    const info = insPlan.run(
      idBySlug.get(emp.slug),
      planType,
      yearOf(row.FORM_TAX_PRD, year),
      row.PLAN_NAME || null,
      row.SPONS_DFE_PN || null,
      row.SPONSOR_DFE_NAME || null,
      String(row.SPONS_DFE_EIN || '').replace(/\D/g, '') || null,
      row.SPONS_DFE_MAIL_US_STATE || null,
      row.TYPE_PENSION_BNFT_CODE || null,
      row.TYPE_WELFARE_BNFT_CODE || null,
      toInt(row.TOT_PARTCP_BOY_CNT),
      toInt(row.TOT_ACTIVE_PARTCP_CNT),
      toInt(row.SCH_H_ATTACHED_IND),
      toInt(row.SCH_R_ATTACHED_IND),
      row.ACK_ID || null,
      today,
    );
    written += info.changes;
    if (scanned % 100000 === 0) console.log(`  ...scanned ${scanned.toLocaleString()} (matched ${matched})`);
  }
  db.exec('COMMIT');

  db.prepare(`
    INSERT INTO ingest_run (source, dataset, plan_year, rows_scanned, rows_matched, plans_written, started_at, finished_at)
    VALUES ('form5500', ?, ?, ?, ?, ?, ?, ?)
  `).run(`F_5500_${year}`, year, scanned, matched, written, today, today);

  console.log(`  scanned ${scanned.toLocaleString()}, matched ${matched.toLocaleString()}, new plans ${written.toLocaleString()}`);
}

async function main() {
  const db = openDb();
  const { employers, idBySlug } = loadEmployers(db);
  const matcher = buildMatcher(employers);
  console.log(`Loaded ${employers.length} seed employers.`);
  for (const y of YEARS) await ingestYear(db, y, matcher, idBySlug);
  db.close();
  console.log('\nDone. Run `npm run report` for a summary.');
}

main().catch((e) => { console.error(e); process.exit(1); });
