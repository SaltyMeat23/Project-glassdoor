// Enrich existing Neon employer rows with manually-curated profile data from a
// Bubble Companies export (about / website / logo / industry). Matches by
// normalized company name; only overwrites when the CSV has a non-empty value.
// Idempotent — safe to re-run after more manual/auto enrichment.
//
// Run: cd platform && node --env-file=../.env src/enrich-companies.mjs <csv>

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { q, close } from './lib/db-postgres.mjs';
import { normalizeName } from './lib/normalize.mjs';

const CSV = process.argv[2] || 'C:/Users/kthie/Downloads/export_All-Companies_2026-07-22_01-19-14.csv';
const clean = (v) => { const s = String(v ?? '').trim(); return s && s.length > 1 ? s : null; };

async function main() {
  const rows = parse(readFileSync(CSV), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });
  // map normalized display_name -> employer id (Neon)
  const emps = await q('SELECT id, display_name FROM employer');
  const byNorm = new Map(emps.map((e) => [normalizeName(e.display_name), e.id]));

  let updated = 0, unmatched = 0;
  for (const r of rows) {
    const about = clean(r.company_About);
    const website = clean(r.company_Website);
    const logo = clean(r.companyLogo);
    const industry = clean(r.industry);
    if (!about && !website && !logo && !industry) continue; // nothing to enrich
    const id = byNorm.get(normalizeName(r.company_Name));
    if (!id) { unmatched++; continue; }
    // COALESCE: only set when the CSV has a value; keep existing otherwise
    await q(
      `UPDATE employer SET
         about = COALESCE($1, about),
         website = COALESCE($2, website),
         logo_url = COALESCE($3, logo_url),
         industry = COALESCE($4, industry)
       WHERE id = $5`,
      [about, website, logo, industry, id]
    );
    updated++;
  }

  const withAbout = (await q("SELECT COUNT(*)::int c FROM employer WHERE about IS NOT NULL"))[0].c;
  console.log(`Enriched ${updated} employers from ${rows.length} CSV rows (${unmatched} unmatched).`);
  console.log(`Employers with a description now: ${withAbout}`);
  await close();
}
main().catch(async (e) => { console.error('✗', e.message); await close(); process.exit(1); });
