// Merge per-employer web-extraction files (data/web_raw/*.json, written by
// research agents) into the canonical data/employer_web.seed.json, upserting by
// slug. The seed is the committed artifact; web_raw/ is scratch (git-ignored).
//
// Usage: node src/merge-web.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(__dirname, '..', 'data', 'employer_web.seed.json');
const RAW_DIR = resolve(__dirname, '..', 'data', 'web_raw');

if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

const seed = existsSync(SEED)
  ? JSON.parse(readFileSync(SEED, 'utf8'))
  : { _comment: '', fetched_period: '2026-07', employers: [] };

const bySlug = new Map((seed.employers || []).map((e) => [e.slug, e]));

let merged = 0, termCount = 0;
for (const f of readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8'));
  if (!raw.slug || !Array.isArray(raw.terms)) { console.warn(`  ! skip ${f} (no slug/terms)`); continue; }
  // attach fetched_period onto each term if absent
  for (const t of raw.terms) if (!t.fetched_period) t.fetched_period = raw.fetched_period || seed.fetched_period;
  bySlug.set(raw.slug, { slug: raw.slug, terms: raw.terms });
  merged++;
  termCount += raw.terms.length;
}

seed.employers = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n');

const totalTerms = seed.employers.reduce((n, e) => n + (e.terms?.length || 0), 0);
console.log(`Merged ${merged} raw file(s) (${termCount} terms) into seed.`);
console.log(`Seed now: ${seed.employers.length} employers, ${totalTerms} terms.`);
