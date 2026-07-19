// Comp benchmark engine — the "How do I compare?" core.
//
// Given a query cell (role_family × clearance_tier × metro × yoe_band, plus
// optional GovCon refinements), return the market pay distribution and the
// user's percentile — under strict k-anonymity (docs/SECURITY.md §7): a cell is
// NEVER shown below k submissions. When a cell is thin we WIDEN down a fallback
// ladder (never lower k) and honestly label how far we coarsened.
//
// Total comp reuses the benefits valuation engine (valuation/engine.mjs) as an
// additive "+$X/yr in benefits" — we benchmark the CASH percentile like-for-like
// (we don't store per-datapoint benefits) and present valued benefits alongside.

import { valuate } from '../valuation/engine.mjs';

const DEFAULT_K = 5;
const STALE_MONTHS = 24; // datapoints older than this are excluded (decay stale imports)

// ---- small stats helpers ---------------------------------------------------
const round1k = (n) => (n == null ? null : Math.round(n / 1000) * 1000);

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
/** Percentile rank of value v within sorted[]: % of values <= v. */
function pctRank(sorted, v) {
  if (v == null || !sorted.length) return null;
  let c = 0;
  for (const x of sorted) if (x <= v) c++;
  return Math.round((100 * c) / sorted.length);
}
/** Drop bottom/top 1% once the sample is large enough to have real outliers. */
function trimOutliers(sorted) {
  if (sorted.length < 20) return sorted;
  const lo = quantile(sorted, 0.01), hi = quantile(sorted, 0.99);
  return sorted.filter((x) => x >= lo && x <= hi);
}

// ---- staleness cutoff (coarse YYYY-MM, STALE_MONTHS ago) --------------------
function cutoffPeriod() {
  const d = new Date();
  d.setMonth(d.getMonth() - STALE_MONTHS);
  return d.toISOString().slice(0, 7);
}

// ---- the coarsening ladder -------------------------------------------------
// Ordered most-specific -> least. Walk until a level has count >= k.
function buildLadder(q) {
  const core = { role_family: q.role_family, clearance_tier: q.clearance_tier, metro: q.metro, yoe_band: q.yoe_band };
  const refs = {};
  if (q.prime_sub) refs.prime_sub = q.prime_sub;
  if (q.customer_sector) refs.customer_sector = q.customer_sector;
  if (q.lcat) refs.lcat = q.lcat;

  const levels = [];
  if (Object.keys(refs).length) levels.push({ label: 'exact cell + your contract details', where: { ...core, ...refs } });
  levels.push({ label: 'exact cell', where: { ...core } });
  levels.push({ label: 'any experience level', where: { role_family: q.role_family, clearance_tier: q.clearance_tier, metro: q.metro } });
  levels.push({ label: 'nationwide (same experience)', where: { role_family: q.role_family, clearance_tier: q.clearance_tier, yoe_band: q.yoe_band } });
  levels.push({ label: 'nationwide, any experience', where: { role_family: q.role_family, clearance_tier: q.clearance_tier } });
  if (['ts_sci', 'ts_sci_poly'].includes(q.clearance_tier)) {
    levels.push({ label: 'nationwide, TS/SCI+ combined', where: { role_family: q.role_family }, clearanceIn: ['ts_sci', 'ts_sci_poly'] });
  }
  levels.push({ label: 'nationwide, any clearance', where: { role_family: q.role_family } });
  return levels;
}

function levelSql(level, cutoff) {
  const clauses = ["base IS NOT NULL", "submitted_period >= ?"];
  const params = [cutoff];
  for (const [col, val] of Object.entries(level.where)) { clauses.push(`${col} = ?`); params.push(val); }
  if (level.clearanceIn) { clauses.push(`clearance_tier IN (${level.clearanceIn.map(() => '?').join(',')})`); params.push(...level.clearanceIn); }
  return { sql: `SELECT base, total_cash FROM comp_datapoint WHERE ${clauses.join(' AND ')}`, params };
}

// ---- verdict ---------------------------------------------------------------
function verdict(basePct) {
  if (basePct == null) return null;
  if (basePct < 25) return { band: 'below', text: 'This offer looks below market for your profile.' };
  if (basePct < 45) return { band: 'slightly_below', text: 'This offer is slightly below the market midpoint.' };
  if (basePct < 65) return { band: 'at', text: 'This offer is right around market for your profile.' };
  if (basePct < 80) return { band: 'above', text: 'This offer is above the market midpoint — competitive.' };
  return { band: 'strong', text: 'This offer is strong — top of market for your profile.' };
}

// ---- benefits add-on (reuse the valuation engine, zero engine changes) -----
function benefitsAddOn(db, query) {
  if (!query.base) return null;
  const profile = { salary: query.base, family_status: query.family_status || 'single', contribution_rate: 0.10, health_usage_tier: 'medium' };
  let employer = null;
  if (query.employer_id) {
    employer = db.prepare('SELECT id, slug, display_name, ownership FROM employer WHERE id = ?').get(query.employer_id);
  }
  if (!employer) employer = { id: -1, slug: '__benchmark__', display_name: 'Sector benchmark', ownership: null };
  const r = valuate(db, employer, profile);
  return {
    employer: employer.id === -1 ? null : employer.display_name,
    benefits_total: r.subtotals.benefits_total,
    lines: r.lines.map((l) => ({ label: l.label, value: l.value, confidence: l.confidence, data_status: l.data_status })),
    gaps: r.gaps,
  };
}

/**
 * Benchmark a comp query. Returns:
 *   { status:'ok', level, coarsened, n, distribution:{p25,p50,p75,p90},
 *     base_percentile, total_cash_percentile, verdict, benefits }
 * or { status:'insufficient', k, have } when even the widest cell is below k.
 */
export function benchmark(db, query, { k = DEFAULT_K } = {}) {
  const cutoff = cutoffPeriod();
  const ladder = buildLadder(query);

  let resolved = null, best = { n: 0 };
  for (let i = 0; i < ladder.length; i++) {
    const { sql, params } = levelSql(ladder[i], cutoff);
    const rows = db.prepare(sql).all(...params);
    if (rows.length > best.n) best = { n: rows.length, level: ladder[i] };
    if (rows.length >= k) { resolved = { level: ladder[i], levelIndex: i, rows }; break; }
  }

  if (!resolved) return { status: 'insufficient', k, have: best.n, cell: describeCell(query) };

  const bases = trimOutliers(resolved.rows.map((r) => r.base).filter((x) => x != null).sort((a, b) => a - b));
  const totals = trimOutliers(resolved.rows.map((r) => r.total_cash ?? r.base).filter((x) => x != null).sort((a, b) => a - b));
  const userTotal = query.base != null ? query.base + (query.bonus || 0) : null;

  return {
    status: 'ok',
    level: resolved.level.label,
    coarsened: resolved.levelIndex > (query.prime_sub || query.customer_sector || query.lcat ? 1 : 0), // widened beyond the exact requested cell
    n: bases.length,
    distribution: { p25: round1k(quantile(bases, 0.25)), p50: round1k(quantile(bases, 0.5)), p75: round1k(quantile(bases, 0.75)), p90: round1k(quantile(bases, 0.9)) },
    base_percentile: pctRank(bases, query.base),
    total_cash_percentile: pctRank(totals, userTotal),
    approximate: bases.length < 15,
    verdict: verdict(pctRank(bases, query.base)),
    benefits: benefitsAddOn(db, query),
  };
}

function describeCell(q) {
  return [q.role_family, q.clearance_tier, q.metro, q.yoe_band].filter(Boolean).join(' · ');
}
