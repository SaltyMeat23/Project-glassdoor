// Ingest the ClearanceJobs company index (name-only directory) into Neon.
// Grows the employer table from the curated seed to the full cleared universe.
// Dedups against existing employers + seed match-aliases so we don't duplicate
// the 39 curated primes. Imported rows are is_seed=0, provenance='clearancejobs_2024'.
//
// Run: cd platform && node --env-file=../.env src/ingest-companies.mjs [path-to-csv]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { q, close } from './lib/db-postgres.mjs';
import { normalizeName, buildMatcher } from './lib/normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '..', 'data', 'employers.seed.json');
const CSV =
  process.argv[2] ||
  'C:/Users/kthie/Downloads/export_All-Companies_2024-08-03_16-07-51.csv';

const NEW_COLS = [
  'website TEXT', 'industry TEXT', 'year_founded INTEGER', 'locality TEXT',
  'region TEXT', 'linkedin_url TEXT', 'logo_url TEXT', 'about TEXT', 'provenance TEXT',
];

function slugify(name) {
  return normalizeName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'company';
}
const clean = (v) => { const s = String(v ?? '').trim(); return s && s.length > 1 ? s : null; };

async function main() {
  // 1. ensure profile columns exist on the live table
  for (const col of NEW_COLS) await q(`ALTER TABLE employer ADD COLUMN IF NOT EXISTS ${col}`);

  // 2. existing employers + seed matcher (dedup)
  const existing = await q('SELECT slug, display_name FROM employer');
  const existingSlugs = new Set(existing.map((e) => e.slug));
  const existingNorm = new Set(existing.map((e) => normalizeName(e.display_name)));
  const { employers: seed } = JSON.parse(readFileSync(SEED, 'utf8'));
  const matcher = buildMatcher(seed);

  // 3. parse CSV
  const rows = parse(readFileSync(CSV), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });

  const toInsert = [];
  const usedSlugs = new Set(existingSlugs);
  let dupExisting = 0, dupSeed = 0, dupInBatch = 0;

  for (const r of rows) {
    const name = clean(r.company_Name);
    if (!name) continue;
    const norm = normalizeName(name);
    if (!norm) continue;
    if (existingNorm.has(norm)) { dupExisting++; continue; }      // already an employer
    if (matcher.matchName(norm)) { dupSeed++; continue; }          // subsidiary/alias of a seed prime
    // unique slug
    let slug = slugify(name), n = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(name)}-${n++}`;
    if (existingNorm.has(norm)) { dupInBatch++; continue; }
    usedSlugs.add(slug);
    existingNorm.add(norm);
    toInsert.push({
      slug, display_name: name,
      website: clean(r.company_Website), industry: clean(r.industry),
      about: clean(r.company_About), logo_url: clean(r.companyLogo),
    });
  }

  // 4. bulk insert
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const batch = toInsert.slice(i, i + CHUNK);
    const params = [];
    const tuples = batch.map((e) => {
      const row = [e.slug, e.display_name, 0, 'clearancejobs_2024', e.website, e.industry, e.about, e.logo_url];
      const ph = row.map((v) => { params.push(v); return `$${params.length}`; });
      return `(${ph.join(',')})`;
    });
    const res = await q(
      `INSERT INTO employer (slug, display_name, is_seed, provenance, website, industry, about, logo_url)
       VALUES ${tuples.join(',')} ON CONFLICT (slug) DO NOTHING RETURNING id`,
      params
    );
    inserted += res.length;
  }

  const total = (await q('SELECT COUNT(*)::int AS c FROM employer'))[0].c;
  console.log(`CSV rows: ${rows.length}`);
  console.log(`  skipped — already an employer: ${dupExisting}`);
  console.log(`  skipped — alias of a seed prime: ${dupSeed}`);
  console.log(`  inserted new directory employers: ${inserted}`);
  console.log(`employer table now: ${total} companies`);
  await close();
}

main().catch(async (e) => { console.error('✗', e.message); await close(); process.exit(1); });
