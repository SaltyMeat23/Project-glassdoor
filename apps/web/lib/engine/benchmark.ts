// Comp benchmark — async Neon port of platform/src/comp/benchmark.mjs.
// k-anonymity coarsening ladder + percentiles + verdict + total-comp add-on.
// A cell is NEVER shown below k (SECURITY §7); we widen, never lower k.
import { q } from './db';
import { valuate } from './valuation';

const DEFAULT_K = 5;
const STALE_MONTHS = 24;

const round1k = (n: number | null) => (n == null ? null : Math.round(n / 1000) * 1000);

function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function pctRank(sorted: number[], v: number | null): number | null {
  if (v == null || !sorted.length) return null;
  let c = 0;
  for (const x of sorted) if (x <= v) c++;
  return Math.round((100 * c) / sorted.length);
}
function trimOutliers(sorted: number[]): number[] {
  if (sorted.length < 20) return sorted;
  const lo = quantile(sorted, 0.01)!,
    hi = quantile(sorted, 0.99)!;
  return sorted.filter((x) => x >= lo && x <= hi);
}

function cutoffPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - STALE_MONTHS);
  return d.toISOString().slice(0, 7);
}

export type Query = {
  role_family: string;
  clearance_tier: string | null;
  metro: string;
  yoe_band: string | null;
  base?: number | null;
  bonus?: number | null;
  employer_id?: number | null;
  employer_name?: string | null;
  prime_sub?: string | null;
  customer_sector?: string | null;
  lcat?: string | null;
  family_status?: string;
};

type Level = { label: string; where: Record<string, string | null>; clearanceIn?: string[] };

function buildLadder(query: Query): Level[] {
  const core = {
    role_family: query.role_family,
    clearance_tier: query.clearance_tier,
    metro: query.metro,
    yoe_band: query.yoe_band,
  };
  const refs: Record<string, string> = {};
  if (query.prime_sub) refs.prime_sub = query.prime_sub;
  if (query.customer_sector) refs.customer_sector = query.customer_sector;
  if (query.lcat) refs.lcat = query.lcat;

  const levels: Level[] = [];
  if (Object.keys(refs).length)
    levels.push({ label: 'exact cell + your contract details', where: { ...core, ...refs } });
  levels.push({ label: 'exact cell', where: { ...core } });
  levels.push({
    label: 'any experience level',
    where: {
      role_family: query.role_family,
      clearance_tier: query.clearance_tier,
      metro: query.metro,
    },
  });
  levels.push({
    label: 'nationwide (same experience)',
    where: {
      role_family: query.role_family,
      clearance_tier: query.clearance_tier,
      yoe_band: query.yoe_band,
    },
  });
  levels.push({
    label: 'nationwide, any experience',
    where: { role_family: query.role_family, clearance_tier: query.clearance_tier },
  });
  if (query.clearance_tier && ['ts_sci', 'ts_sci_poly'].includes(query.clearance_tier)) {
    levels.push({
      label: 'nationwide, TS/SCI+ combined',
      where: { role_family: query.role_family },
      clearanceIn: ['ts_sci', 'ts_sci_poly'],
    });
  }
  levels.push({ label: 'nationwide, any clearance', where: { role_family: query.role_family } });
  return levels;
}

function levelSql(level: Level, cutoff: string): { text: string; params: unknown[] } {
  const clauses = ['base IS NOT NULL', 'submitted_period >= $1'];
  const params: unknown[] = [cutoff];
  for (const [col, val] of Object.entries(level.where)) {
    params.push(val);
    clauses.push(`${col} = $${params.length}`);
  }
  if (level.clearanceIn) {
    const ph = level.clearanceIn.map((v) => {
      params.push(v);
      return `$${params.length}`;
    });
    clauses.push(`clearance_tier IN (${ph.join(',')})`);
  }
  return {
    text: `SELECT base, total_cash FROM comp_datapoint WHERE ${clauses.join(' AND ')}`,
    params,
  };
}

function verdict(basePct: number | null) {
  if (basePct == null) return null;
  if (basePct < 25)
    return { band: 'below', text: 'This offer looks below market for your profile.' };
  if (basePct < 45)
    return { band: 'slightly_below', text: 'This offer is slightly below the market midpoint.' };
  if (basePct < 65)
    return { band: 'at', text: 'This offer is right around market for your profile.' };
  if (basePct < 80)
    return { band: 'above', text: 'This offer is above the market midpoint — competitive.' };
  return { band: 'strong', text: 'This offer is strong — top of market for your profile.' };
}

export async function benefitsAddOn(query: Query) {
  if (!query.base) return null;
  const v = await valuate(query.employer_id ?? null, {
    salary: query.base,
    family_status: query.family_status || 'single',
    contribution_rate: 0.1,
    health_usage_tier: 'medium',
  });
  return {
    employer: query.employer_name ?? null,
    benefits_total: v.benefits_total,
    lines: v.lines.map((l) => ({
      label: l.label,
      value: l.value,
      confidence: l.confidence,
      data_status: l.data_status,
    })),
    gaps: v.gaps,
  };
}

const describeCell = (q: Query) =>
  [q.role_family, q.clearance_tier, q.metro, q.yoe_band].filter(Boolean).join(' · ');

export async function benchmark(query: Query, { k = DEFAULT_K }: { k?: number } = {}) {
  const cutoff = cutoffPeriod();
  const ladder = buildLadder(query);

  let resolved: {
    level: Level;
    levelIndex: number;
    rows: { base: number; total_cash: number | null }[];
  } | null = null;
  let best = { n: 0, level: null as Level | null };
  for (let i = 0; i < ladder.length; i++) {
    const { text, params } = levelSql(ladder[i], cutoff);
    const rows = await q<{ base: number; total_cash: number | null }>(text, params);
    if (rows.length > best.n) best = { n: rows.length, level: ladder[i] };
    if (rows.length >= k) {
      resolved = { level: ladder[i], levelIndex: i, rows };
      break;
    }
  }

  if (!resolved)
    return { status: 'insufficient' as const, k, have: best.n, cell: describeCell(query) };

  const bases = trimOutliers(
    resolved.rows
      .map((r) => r.base)
      .filter((x) => x != null)
      .sort((a, b) => a - b)
  );
  const totals = trimOutliers(
    resolved.rows
      .map((r) => r.total_cash ?? r.base)
      .filter((x) => x != null)
      .sort((a, b) => a - b)
  );
  const userTotal = query.base != null ? query.base + (query.bonus || 0) : null;
  const requestedNarrow = query.prime_sub || query.customer_sector || query.lcat ? 1 : 0;

  return {
    status: 'ok' as const,
    level: resolved.level.label,
    coarsened: resolved.levelIndex > requestedNarrow,
    n: bases.length,
    distribution: {
      p25: round1k(quantile(bases, 0.25)),
      p50: round1k(quantile(bases, 0.5)),
      p75: round1k(quantile(bases, 0.75)),
      p90: round1k(quantile(bases, 0.9)),
    },
    base_percentile: pctRank(bases, query.base ?? null),
    total_cash_percentile: pctRank(totals, userTotal),
    approximate: bases.length < 15,
    verdict: verdict(pctRank(bases, query.base ?? null)),
    benefits: await benefitsAddOn(query),
  };
}
