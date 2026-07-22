// Ingest cleared job postings into Neon (docs/JOBS.md §6 prototype).
//
//   node --env-file=../.env src/ingest-jobs.mjs            # seed + ingest (default)
//   node --env-file=../.env src/ingest-jobs.mjs seed       # map known boards → ats_source
//   node --env-file=../.env src/ingest-jobs.mjs ingest     # fetch + upsert job_posting
//   node --env-file=../.env src/ingest-jobs.mjs detect --limit 300   # probe for more boards
//
// Greenhouse only for now (cleanest public API). Writes EMPLOYER data
// (job_posting, ats_source) — never candidate/PII (SECURITY.md wall).

import { q, close } from './lib/db-postgres.mjs';
import { normalizeName } from './lib/normalize.mjs';
import { fetchBoardMeta, fetchGreenhouseJobs, normalizeJob } from './lib/ats-greenhouse.mjs';

const PERIOD = new Date().toISOString().slice(0, 7); // coarse 'YYYY-MM'

// Verified cleared-defense Greenhouse boards (token → canonical name).
const SEED = [
  { token: 'andurilindustries', name: 'Anduril Industries' },
  { token: 'vannevarlabs', name: 'Vannevar Labs' },
  { token: 'hawkeye360', name: 'HawkEye 360' },
  { token: 'epirus', name: 'Epirus' },
  { token: 'chaosindustries', name: 'CHAOS Industries' },
];

function slugify(name) {
  return (
    normalizeName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'company'
  );
}

/** Find an employer by normalized name; create a minimal row if missing. */
async function resolveEmployer(name) {
  const norm = normalizeName(name);
  const hit = await q('SELECT id, display_name FROM employer');
  const match = hit.find((e) => normalizeName(e.display_name) === norm);
  if (match) return match.id;
  // Create — unique slug.
  const taken = new Set(hit.map((e) => e.slug).filter(Boolean));
  let slug = slugify(name);
  for (let n = 2; taken.has(slug); n++) slug = `${slugify(name)}-${n}`;
  const row = await q(
    `INSERT INTO employer (slug, display_name, is_seed, provenance)
     VALUES ($1, $2, 0, 'jobs_seed') RETURNING id`,
    [slug, name]
  );
  console.log(`  + added employer "${name}"`);
  return row[0].id;
}

async function seed() {
  for (const { token, name } of SEED) {
    const meta = await fetchBoardMeta(token);
    if (!meta) {
      console.log(`  ✗ ${token}: no Greenhouse board`);
      continue;
    }
    const empId = await resolveEmployer(name);
    await q(
      `INSERT INTO ats_source (employer_id, ats_type, board_token, detected_at)
       VALUES ($1, 'greenhouse', $2, $3)
       ON CONFLICT (employer_id, ats_type)
       DO UPDATE SET board_token = EXCLUDED.board_token, detected_at = EXCLUDED.detected_at`,
      [empId, token, PERIOD]
    );
    console.log(`  ✓ ${name} → greenhouse/${token}`);
  }
}

async function ingestBoard(employerId, token) {
  const jobs = await fetchGreenhouseJobs(token);
  if (!jobs) {
    console.log(`  ✗ ${token}: fetch failed`);
    return { cleared: 0, withPay: 0 };
  }
  const seen = [];
  let withPay = 0;
  for (const raw of jobs) {
    const p = normalizeJob(raw);
    if (!p) continue; // not cleared
    seen.push(p.req_id);
    if (p.salary_min != null) withPay++;
    await q(
      `INSERT INTO job_posting
         (employer_id, source, req_id, title, role_family, lcat_raw, clearance_tier,
          metro, location_raw, remote, salary_min, salary_max, source_url, posted_period,
          last_seen, is_open)
       VALUES ($1,'greenhouse',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)
       ON CONFLICT (employer_id, source, req_id) DO UPDATE SET
         title=EXCLUDED.title, role_family=EXCLUDED.role_family, lcat_raw=EXCLUDED.lcat_raw,
         clearance_tier=EXCLUDED.clearance_tier, metro=EXCLUDED.metro,
         location_raw=EXCLUDED.location_raw, remote=EXCLUDED.remote,
         salary_min=EXCLUDED.salary_min, salary_max=EXCLUDED.salary_max,
         source_url=EXCLUDED.source_url, posted_period=EXCLUDED.posted_period,
         last_seen=EXCLUDED.last_seen, is_open=TRUE`,
      [
        employerId, p.req_id, p.title, p.role_family, p.lcat_raw, p.clearance_tier,
        p.metro, p.location_raw, p.remote, p.salary_min, p.salary_max, p.source_url,
        p.posted_period, PERIOD,
      ]
    );
  }
  // Close postings no longer on the board (roles that disappeared).
  await q(
    `UPDATE job_posting SET is_open = FALSE
     WHERE employer_id = $1 AND source = 'greenhouse' AND NOT (req_id = ANY($2::text[]))`,
    [employerId, seen]
  );
  return { cleared: seen.length, withPay };
}

async function ingest() {
  const sources = await q(
    `SELECT s.employer_id, s.board_token, e.display_name
       FROM ats_source s JOIN employer e ON e.id = s.employer_id
      WHERE s.ats_type = 'greenhouse' ORDER BY e.display_name`
  );
  let totCleared = 0,
    totPay = 0;
  for (const s of sources) {
    const { cleared, withPay } = await ingestBoard(s.employer_id, s.board_token);
    totCleared += cleared;
    totPay += withPay;
    console.log(`  ✓ ${s.display_name}: ${cleared} cleared roles (${withPay} with pay band)`);
  }
  console.log(
    `\nIngested ${totCleared} cleared postings across ${sources.length} boards; ${totPay} carry a salary band.`
  );
}

// Optional: probe employers for a Greenhouse board by name-guess, with a
// name-match guard so we never attach the wrong company's jobs.
async function detect(limit) {
  const emps = await q(
    `SELECT id, display_name FROM employer e
      WHERE about IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM ats_source s WHERE s.employer_id = e.id)
      ORDER BY display_name LIMIT $1`,
    [limit]
  );
  let found = 0;
  for (const e of emps) {
    const base = e.display_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const first = e.display_name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidates = [...new Set([base, first])].filter((t) => t.length >= 4);
    for (const token of candidates) {
      const meta = await fetchBoardMeta(token);
      if (!meta?.name) continue;
      // Name-match guard: the board's name must overlap the employer's.
      const bn = normalizeName(meta.name);
      const en = normalizeName(e.display_name);
      if (!(bn.includes(en.split(' ')[0]) || en.includes(bn.split(' ')[0]))) continue;
      await q(
        `INSERT INTO ats_source (employer_id, ats_type, board_token, detected_at)
         VALUES ($1, 'greenhouse', $2, $3) ON CONFLICT (employer_id, ats_type) DO NOTHING`,
        [e.id, token, PERIOD]
      );
      console.log(`  ✓ detected ${e.display_name} → greenhouse/${token}`);
      found++;
      break;
    }
  }
  console.log(`\nDetected ${found} new Greenhouse boards across ${emps.length} probed employers.`);
}

async function main() {
  const cmd = process.argv[2] || 'all';
  if (cmd === 'seed' || cmd === 'all') await seed();
  if (cmd === 'detect') {
    const i = process.argv.indexOf('--limit');
    await detect(Number(i === -1 ? 300 : process.argv[i + 1]));
  }
  if (cmd === 'ingest' || cmd === 'all') await ingest();
  await close();
}

main().catch(async (e) => {
  console.error('✗', e.message);
  await close();
  process.exit(1);
});
