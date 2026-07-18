// Merge the focused medical-premium pass (data/web_raw_medical/*.json) into the
// canonical seed by UPSERTING terms into each employer block by term_key —
// appending new medical terms and replacing any same-key term, WITHOUT dropping
// the employer's existing (batch-1/2/3) terms.
//
// Usage: node src/merge-medical.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '..', 'data', 'employer_web.seed.json');
const RAW_DIR = resolve(__dirname, '..', 'data', 'web_raw_medical');

if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });
const seed = JSON.parse(readFileSync(SEED, 'utf8'));
const bySlug = new Map((seed.employers || []).map((e) => [e.slug, e]));

let files = 0, upserts = 0;
for (const f of readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8'));
  if (!raw.slug || !Array.isArray(raw.terms)) { console.warn(`  ! skip ${f}`); continue; }
  const emp = bySlug.get(raw.slug);
  if (!emp) { console.warn(`  ! unknown slug ${raw.slug} in ${f}`); continue; }
  files++;
  const byKey = new Map((emp.terms || []).map((t) => [t.term_key, t]));
  for (const t of raw.terms) {
    if (!t.fetched_period) t.fetched_period = raw.fetched_period || seed.fetched_period;
    byKey.set(t.term_key, t); // upsert by term_key
    upserts++;
  }
  emp.terms = [...byKey.values()];
}

seed.employers = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n');
const totalTerms = seed.employers.reduce((n, e) => n + (e.terms?.length || 0), 0);
console.log(`Merged medical terms from ${files} file(s), ${upserts} upserts.`);
console.log(`Seed now: ${seed.employers.length} employers, ${totalTerms} terms.`);
