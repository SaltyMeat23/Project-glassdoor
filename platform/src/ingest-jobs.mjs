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
import {
  fetchBoardMeta,
  fetchGreenhouseJobs,
  normalizeJob,
  stripHtml,
  extractSalaryBand,
  clearanceSignal,
  tierFromText,
} from './lib/ats-greenhouse.mjs';
import { fetchWorkdayCleared, normalizeWorkdayJob, fetchWorkdayJD } from './lib/ats-workday.mjs';
import { fetchIcimsCleared, normalizeIcimsJob, fetchIcimsJD } from './lib/ats-icims.mjs';
import { detectFromWebsite } from './lib/ats-detect.mjs';

const IMPLEMENTED = ['greenhouse', 'workday', 'icims']; // ATS we can ingest today

const PERIOD = new Date().toISOString().slice(0, 7); // coarse 'YYYY-MM'
const WD_MAX_PAGES = 60; // ~1,200 cleared roles/board cap for the prototype

// Verified cleared-defense boards (ats_type → [{ token, name }]).
// Greenhouse token = board handle; Workday token = "host::tenant::site".
const SEED = {
  greenhouse: [
    { token: 'andurilindustries', name: 'Anduril Industries' },
    { token: 'vannevarlabs', name: 'Vannevar Labs' },
    { token: 'hawkeye360', name: 'HawkEye 360' },
    { token: 'epirus', name: 'Epirus' },
    { token: 'chaosindustries', name: 'CHAOS Industries' },
  ],
  workday: [
    { token: 'leidos.wd5.myworkdayjobs.com::leidos::External', name: 'Leidos' },
    { token: 'ngc.wd1.myworkdayjobs.com::ngc::Northrop_Grumman_External_Site', name: 'Northrop Grumman' },
    { token: 'caci.wd1.myworkdayjobs.com::caci::External', name: 'CACI International' },
    { token: 'kbr.wd5.myworkdayjobs.com::kbr::KBR_Careers', name: 'KBR' },
  ],
};

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

async function upsertSource(empId, atsType, token) {
  await q(
    `INSERT INTO ats_source (employer_id, ats_type, board_token, detected_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (employer_id, ats_type)
     DO UPDATE SET board_token = EXCLUDED.board_token, detected_at = EXCLUDED.detected_at`,
    [empId, atsType, token, PERIOD]
  );
}

async function seed() {
  for (const { token, name } of SEED.greenhouse) {
    if (!(await fetchBoardMeta(token))) {
      console.log(`  ✗ ${token}: no Greenhouse board`);
      continue;
    }
    await upsertSource(await resolveEmployer(name), 'greenhouse', token);
    console.log(`  ✓ ${name} → greenhouse/${token}`);
  }
  for (const { token, name } of SEED.workday) {
    await upsertSource(await resolveEmployer(name), 'workday', token);
    console.log(`  ✓ ${name} → workday/${token.split('::')[0]}`);
  }
}

/** Upsert normalized postings for one employer+source, then close reqs that
 *  disappeared from the board. Returns { cleared, withPay }. */
async function upsertPostings(employerId, source, postings) {
  const seen = [];
  let withPay = 0;
  for (const p of postings) {
    if (!p) continue;
    seen.push(p.req_id);
    if (p.salary_min != null) withPay++;
    await q(
      `INSERT INTO job_posting
         (employer_id, source, req_id, title, role_family, lcat_raw, clearance_tier,
          metro, location_raw, remote, salary_min, salary_max, source_url, posted_period,
          last_seen, is_open)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE)
       ON CONFLICT (employer_id, source, req_id) DO UPDATE SET
         title=EXCLUDED.title, role_family=EXCLUDED.role_family, lcat_raw=EXCLUDED.lcat_raw,
         clearance_tier=EXCLUDED.clearance_tier, metro=EXCLUDED.metro,
         location_raw=EXCLUDED.location_raw, remote=EXCLUDED.remote,
         salary_min=EXCLUDED.salary_min, salary_max=EXCLUDED.salary_max,
         source_url=EXCLUDED.source_url, posted_period=EXCLUDED.posted_period,
         last_seen=EXCLUDED.last_seen, is_open=TRUE`,
      [
        employerId, source, p.req_id, p.title, p.role_family, p.lcat_raw, p.clearance_tier,
        p.metro, p.location_raw, p.remote, p.salary_min, p.salary_max, p.source_url,
        p.posted_period, PERIOD,
      ]
    );
  }
  await q(
    `UPDATE job_posting SET is_open = FALSE
     WHERE employer_id = $1 AND source = $2 AND NOT (req_id = ANY($3::text[]))`,
    [employerId, source, seen]
  );
  return { cleared: seen.length, withPay };
}

async function ingestOne(src) {
  if (src.ats_type === 'greenhouse') {
    const jobs = await fetchGreenhouseJobs(src.board_token);
    if (!jobs) return null;
    return upsertPostings(src.employer_id, 'greenhouse', jobs.map(normalizeJob));
  }
  if (src.ats_type === 'workday') {
    const res = await fetchWorkdayCleared(src.board_token, { maxPages: WD_MAX_PAGES });
    if (!res) return null;
    const norm = res.jobs.map((j) => normalizeWorkdayJob(j, res.wd));
    const out = await upsertPostings(src.employer_id, 'workday', norm);
    if (res.truncated) console.log(`     (capped at ${res.jobs.length} of ${res.total} board reqs)`);
    return out;
  }
  if (src.ats_type === 'icims') {
    const jobs = await fetchIcimsCleared(src.board_token, { maxPages: 20 });
    if (!jobs) return null;
    return upsertPostings(src.employer_id, 'icims', jobs.map((j) => normalizeIcimsJob(j, src.board_token)));
  }
  return null;
}

// Wire banded postings into the comp benchmark (docs/CONTRACT-INTELLIGENCE.md
// §2.1). A posting is an EMPLOYER-published range, not one person's actual pay,
// so: tag source='posting', use the band MIDPOINT as a market point, and set
// yoe_band='any' (a posting spans experience levels — it joins the benchmark at
// the "any experience" coarsening rung, never a specific-yoe cell). Rebuild is
// idempotent: clear source='posting' rows, re-derive from open banded postings.
async function compFromPostings() {
  await q("DELETE FROM comp_datapoint WHERE source = 'posting'");
  const rows = await q(
    `INSERT INTO comp_datapoint
       (role_family, role_raw, clearance_tier, metro, yoe_band, employer_id,
        base, total_cash, source, confidence, submitted_period)
     SELECT role_family, title, clearance_tier, metro, 'any', employer_id,
            (salary_min + salary_max) / 2.0, (salary_min + salary_max) / 2.0,
            'posting', 'reported', $1
       FROM job_posting
      WHERE is_open AND salary_min IS NOT NULL
        AND clearance_tier IS NOT NULL AND role_family IS NOT NULL
     RETURNING id`,
    [PERIOD]
  );
  console.log(`Derived ${rows.length} comp datapoints from banded postings (source='posting').`);
}

async function ingest() {
  const sources = await q(
    `SELECT s.employer_id, s.ats_type, s.board_token, e.display_name
       FROM ats_source s JOIN employer e ON e.id = s.employer_id
      WHERE s.ats_type = ANY($1) ORDER BY s.ats_type, e.display_name`,
    [IMPLEMENTED]
  );
  let totCleared = 0,
    totPay = 0;
  for (const s of sources) {
    const r = await ingestOne(s);
    if (!r) {
      console.log(`  ✗ ${s.display_name} (${s.ats_type}): fetch failed`);
      continue;
    }
    totCleared += r.cleared;
    totPay += r.withPay;
    console.log(
      `  ✓ ${s.display_name} (${s.ats_type}): ${r.cleared} cleared roles (${r.withPay} with pay band)`
    );
  }
  console.log(
    `\nIngested ${totCleared} cleared postings across ${sources.length} boards; ${totPay} carry a salary band.`
  );
}

async function runPool(items, worker, concurrency) {
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (idx < items.length) await worker(items[idx++]);
    })
  );
}

// Scalable detection: fingerprint each employer's careers page for its ATS and
// record it in ats_source (docs/JOBS.md — the long-tail path). Records ALL
// detected ATS types; only IMPLEMENTED ones get ingested (others await adapters).
async function detect(limit, concurrency = 8) {
  const emps = await q(
    `SELECT id, display_name, website FROM employer e
      WHERE website IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM ats_source s WHERE s.employer_id = e.id)
      ORDER BY (EXISTS(SELECT 1 FROM plan_terms t WHERE t.employer_id = e.id)
                OR EXISTS(SELECT 1 FROM comp_datapoint c WHERE c.employer_id = e.id)) DESC,
               display_name ASC
      LIMIT $1`,
    [limit]
  );
  const byType = {};
  let done = 0;
  await runPool(
    emps,
    async (e) => {
      const hit = await detectFromWebsite(e.website).catch(() => null);
      done++;
      if (hit) {
        await q(
          `INSERT INTO ats_source (employer_id, ats_type, board_token, detected_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT (employer_id, ats_type) DO NOTHING`,
          [e.id, hit.ats_type, hit.board_token, PERIOD]
        );
        byType[hit.ats_type] = (byType[hit.ats_type] || 0) + 1;
        console.log(`  ✓ ${e.display_name} → ${hit.ats_type}/${hit.board_token.split('::')[0]}`);
      }
      if (done % 25 === 0) console.log(`  … ${done}/${emps.length}`);
    },
    concurrency
  );
  const total = Object.values(byType).reduce((a, b) => a + b, 0);
  console.log(`\nDetected ${total} ATS across ${emps.length} probed employers:`, byType);
  const impl = IMPLEMENTED.filter((t) => byType[t]).map((t) => `${byType[t]} ${t}`).join(', ');
  console.log(`Ingestable now (${IMPLEMENTED.join('/')}): ${impl || 'none'}. Run \`ingest\` to pull them.`);
}

// Detail-fetch: pull each Workday posting's full JD and extract a precise
// clearance tier (full-body clearanceSignal — the obtainable-guard finally has
// the whole JD) + salary band. Regex only, NO Claude API. Prioritizes postings
// missing a pay band. Re-runnable; --limit bounds the batch.
async function detail(limit, sources = ['workday', 'icims']) {
  const rows = await q(
    `SELECT jp.id, jp.title, jp.clearance_tier, jp.source, jp.source_url, s.board_token
       FROM job_posting jp
       LEFT JOIN ats_source s ON s.employer_id = jp.employer_id AND s.ats_type = jp.source
      WHERE jp.source = ANY($1) AND jp.is_open AND jp.salary_min IS NULL
      ORDER BY jp.source, jp.id LIMIT $2`,
    [sources, limit]
  );
  let gainedPay = 0,
    gainedTier = 0,
    done = 0;
  await runPool(
    rows,
    async (r) => {
      const html =
        r.source === 'workday'
          ? await fetchWorkdayJD(r.board_token, r.source_url).catch(() => null)
          : await fetchIcimsJD(r.source_url).catch(() => null);
      done++;
      if (!html) return;
      const jd = stripHtml(html);
      const band = extractSalaryBand(jd);
      const tier = clearanceSignal(r.title, jd)?.tier ?? tierFromText(jd) ?? r.clearance_tier;
      await q(`UPDATE job_posting SET salary_min = $1, salary_max = $2, clearance_tier = $3 WHERE id = $4`, [
        band?.min ?? null,
        band?.max ?? null,
        tier,
        r.id,
      ]);
      if (band) gainedPay++;
      if (tier && !r.clearance_tier) gainedTier++;
      if (done % 50 === 0) console.log(`  … ${done}/${rows.length} (${gainedPay} bands, ${gainedTier} tiers)`);
    },
    8
  );
  console.log(
    `\nDetail-fetched ${rows.length} postings [${sources.join('+')}]: +${gainedPay} pay bands, +${gainedTier} tiers.`
  );
}

async function main() {
  const cmd = process.argv[2] || 'all';
  if (cmd === 'detail') {
    const i = process.argv.indexOf('--limit');
    const limit = Number(i === -1 ? 500 : process.argv[i + 1]);
    const src = process.argv[3];
    const sources = src === 'icims' || src === 'workday' ? [src] : ['workday', 'icims'];
    await detail(limit, sources);
    await compFromPostings();
    await close();
    return;
  }
  if (cmd === 'seed' || cmd === 'all') await seed();
  if (cmd === 'detect') {
    const i = process.argv.indexOf('--limit');
    await detect(Number(i === -1 ? 300 : process.argv[i + 1]));
  }
  if (cmd === 'ingest' || cmd === 'all') await ingest();
  if (cmd === 'ingest' || cmd === 'all' || cmd === 'comp') await compFromPostings();
  await close();
}

main().catch(async (e) => {
  console.error('✗', e.message);
  await close();
  process.exit(1);
});
