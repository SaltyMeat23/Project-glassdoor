// Show extracted priced terms (plan_terms) per employer, with confidence and
// source. This is the view that proves what web extraction actually yielded.
// Usage: node src/terms-report.mjs

import { openDb } from './lib/db.mjs';

const db = openDb();
const total = db.prepare('SELECT COUNT(*) c FROM plan_terms').get().c;
if (total === 0) {
  console.log('No plan_terms yet. Run `node src/load-web-terms.mjs` after extraction.');
  process.exit(0);
}

console.log(`\nplan_terms: ${total} rows`);
console.log('by source / confidence:');
for (const r of db.prepare(
  'SELECT source, confidence, COUNT(*) c FROM plan_terms GROUP BY source, confidence ORDER BY c DESC',
).all()) {
  console.log(`  ${String(r.source).padEnd(14)} ${String(r.confidence).padEnd(9)} ${r.c}`);
}

const emps = db.prepare(`
  SELECT DISTINCT e.id, e.display_name n
  FROM plan_terms t JOIN employer e ON e.id = t.employer_id
  ORDER BY e.display_name
`).all();

for (const e of emps) {
  console.log(`\n== ${e.n} ==`);
  const rows = db.prepare(`
    SELECT term_key, value_num, value_text, unit, confidence, plan_year, source_url
    FROM plan_terms WHERE employer_id = ? ORDER BY term_key
  `).all(e.id);
  for (const r of rows) {
    const val = r.value_text || (r.value_num != null ? `${r.value_num}${r.unit ? ' ' + r.unit : ''}` : '');
    const host = r.source_url ? new URL(r.source_url).host : '';
    console.log(
      `  ${String(r.term_key).padEnd(22)} ${String(val).padEnd(34)} [${r.confidence}${r.plan_year ? ' ' + r.plan_year : ''}] ${host}`,
    );
  }
}
db.close();
