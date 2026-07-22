// Comp intake — async Neon port of platform/src/comp/intake-comp.mjs.
// Writes one anonymous comp_datapoint: NO user_id, COARSE period, clearance
// TIER only, metro not site (SECURITY §5). Numbers sanity-bounded server-side.
import { q } from './db';
import {
  roleFamily,
  clearanceTier,
  metroBucket,
  yoeBand,
  primeSub,
  customerSector,
  lcatLevel,
} from './normalize';

const coarsePeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export type CompInput = {
  role?: string | null;
  clearance?: string | null;
  metro?: string | null;
  yoe?: number | string | null;
  base?: number | string | null;
  bonus?: number | string | null;
  employer_id?: number | null;
  prime_sub?: string | null;
  customer?: string | null;
  lcat?: string | null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export type Cell = { role_family: string; clearance_tier: string; metro: string; yoe_band: string };

/** Record one anonymous comp datapoint. Returns the normalized cell (or an error). */
export async function submitComp(
  input: CompInput
): Promise<{ ok: true; cell: Cell } | { ok: false; error: string }> {
  const role_family = roleFamily(input.role);
  const clearance_tier = clearanceTier(input.clearance);
  const metro = metroBucket(input.metro);
  const yoe_band = yoeBand(input.yoe);
  const base = num(input.base);
  const bonus = num(input.bonus);

  if (!clearance_tier || !yoe_band || base == null) {
    return { ok: false, error: 'need clearance, years of experience, and base pay' };
  }
  if (base < 20000 || base > 2000000 || (bonus != null && (bonus < 0 || bonus > 2000000))) {
    return { ok: false, error: 'base/bonus out of the accepted range' };
  }

  const total_cash = base + (bonus || 0);
  await q(
    `INSERT INTO comp_datapoint
       (role_family, role_raw, clearance_tier, metro, yoe_band, employer_id,
        prime_sub, customer_sector, lcat, base, bonus, total_cash,
        source, confidence, submitted_period)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'crowdsourced','inferred',$13)`,
    [
      role_family,
      input.role ?? null,
      clearance_tier,
      metro,
      yoe_band,
      input.employer_id ?? null,
      input.prime_sub ? primeSub(input.prime_sub) : null,
      input.customer ? customerSector(input.customer) : null,
      input.lcat ? lcatLevel(input.lcat) : null,
      base,
      bonus,
      total_cash,
      coarsePeriod(),
    ]
  );
  return { ok: true, cell: { role_family, clearance_tier, metro, yoe_band } };
}
