// Load web-extracted benefit terms into plan_terms.
//
// Reads data/employer_web.seed.json (structured, PROVENANCED terms extracted
// from employer-published benefits pages / total-rewards PDFs) and upserts them
// as plan_terms rows with source='employer_web'. Every term keeps its source_url
// and a verbatim snippet, and is tagged confidence 'reported' (explicit number
// from an employer-published source) or 'inferred' (summarized/second-hand).
//
// These are CANDIDATE values that crowdsourcing later confirms/corrects — never
// presented as verified. Idempotent: re-running replaces this source's rows.
//
// Usage: node src/load-web-terms.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { openDb } from './lib/db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '..', 'data', 'employer_web.seed.json');

const db = openDb();
const data = JSON.parse(readFileSync(SEED, 'utf8'));
const fetched = data.fetched_period || new Date().toISOString().slice(0, 7);

const empId = db.prepare('SELECT id FROM employer WHERE slug = ?');
const planForType = db.prepare(
  'SELECT id FROM benefit_plan WHERE employer_id = ? AND plan_type = ? ORDER BY tot_participants DESC LIMIT 1',
);
const delWeb = db.prepare("DELETE FROM plan_terms WHERE source = 'employer_web' AND employer_id = ?");
const ins = db.prepare(`
  INSERT INTO plan_terms (
    employer_id, benefit_plan_id, term_key, value_num, value_text, unit,
    plan_year, source, confidence, source_url, source_snippet, fetched_period, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'employer_web', ?, ?, ?, ?, ?)
`);

let employers = 0, terms = 0;
db.exec('BEGIN');
for (const e of data.employers || []) {
  const row = empId.get(e.slug);
  if (!row) { console.warn(`  ! unknown employer slug: ${e.slug} (skipped)`); continue; }
  employers++;
  delWeb.run(row.id);
  for (const t of e.terms || []) {
    let planId = null;
    if (t.link_plan_type) {
      const p = planForType.get(row.id, t.link_plan_type);
      if (p) planId = p.id;
    }
    ins.run(
      row.id, planId, t.term_key,
      t.value_num ?? null, t.value_text ?? null, t.unit ?? null,
      t.plan_year ?? null, t.confidence || 'inferred',
      t.source_url ?? null, t.source_snippet ?? null, t.fetched_period || fetched,
      t.notes ?? null,
    );
    terms++;
  }
}
db.exec('COMMIT');

console.log(`Loaded web terms: ${terms} terms across ${employers} employers.`);
db.close();
