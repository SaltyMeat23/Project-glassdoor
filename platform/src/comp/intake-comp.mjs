// Comp intake — the privacy-preserving PAY submission path (parallel to
// intake/service.mjs, which handles benefits). Writes one anonymous row to
// comp_datapoint. Mirrors every SECURITY invariant: NO user_id, COARSE period
// only, clearance TIER only, metro not site, no contract/program name.
//
// The give-to-get unlock token is minted at the API layer (server.mjs / Next
// route), not here — submitComp just records the anonymous datapoint.

import { roleFamily, metroBucket, yoeBand, clearanceTier, customerSector, lcatLevel, primeSub } from './normalize-comp.mjs';

// Same tier→confidence mapping as intake/service.mjs (kept local to avoid
// coupling the two intake paths; both honor the same lifecycle).
const TIER_CONFIDENCE = { doc_verified: 'reported', email_domain: 'reported', unverified: 'inferred' };
const coarsePeriod = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/**
 * Record one anonymous comp datapoint.
 * input: { role_raw, clearance, metro, yoe, base, bonus?, employer_id?,
 *          prime_sub?, customer_sector?, lcat?, verification_tier? }
 * Returns { ok, cell, id } — cell is the normalized (role×clearance×metro×yoe)
 * used to mint the give-to-get token upstream.
 */
export function submitComp(db, input) {
  const role_family = roleFamily(input.role_raw);
  const clearance_tier = clearanceTier(input.clearance);
  const metro = metroBucket(input.metro);
  const yoe_band = yoeBand(input.yoe);
  const base = numOrNull(input.base);
  const bonus = numOrNull(input.bonus);

  // Minimum viable datapoint: a cell + a base. Refuse otherwise (nothing to bench).
  if (!clearance_tier || !yoe_band || base == null) {
    return { ok: false, error: 'need clearance, years of experience, and base pay' };
  }

  const confidence = TIER_CONFIDENCE[input.verification_tier] || 'inferred';
  const total_cash = base + (bonus || 0);
  const info = db.prepare(`
    INSERT INTO comp_datapoint (
      role_family, role_raw, clearance_tier, metro, yoe_band, employer_id,
      prime_sub, customer_sector, lcat, base, bonus, total_cash,
      source, confidence, submitted_period
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'crowdsourced', ?, ?)
  `).run(
    role_family, input.role_raw ?? null, clearance_tier, metro, yoe_band,
    input.employer_id ?? null,
    input.prime_sub ? primeSub(input.prime_sub) : null,
    input.customer_sector ? customerSector(input.customer_sector) : null,
    input.lcat ? lcatLevel(input.lcat) : null,
    base, bonus, total_cash, confidence, coarsePeriod(),
  );

  return { ok: true, id: Number(info.lastInsertRowid), cell: { role_family, clearance_tier, metro, yoe_band } };
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}
