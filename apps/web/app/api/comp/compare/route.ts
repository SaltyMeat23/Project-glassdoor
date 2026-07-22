import { compareSchema, parseBody } from '@/lib/schemas';
import { resolveEmployer } from '@/lib/engine/employers';
import { benchmark, benefitsAddOn, type Query } from '@/lib/engine/benchmark';
import {
  roleFamily,
  clearanceTier,
  metroBucket,
  yoeBand,
  primeSub,
  customerSector,
  lcatLevel,
} from '@/lib/engine/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Value two offers against the same profile, apples-to-apples (base + bonus +
// valued benefits), with each base's market percentile for context.
export const POST = async (req: Request) => {
  const parsed = await parseBody(req, compareSchema);
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  const b = parsed.data;

  try {
    const cell = {
      role_family: roleFamily(b.role),
      clearance_tier: clearanceTier(b.clearance),
      metro: metroBucket(b.metro),
      yoe_band: yoeBand(b.yoe),
      prime_sub: b.prime_sub ? primeSub(b.prime_sub) : null,
      customer_sector: b.customer ? customerSector(b.customer) : null,
      lcat: b.lcat ? lcatLevel(b.lcat) : null,
      family_status: b.family_status,
    };

    let market: { n: number; distribution: unknown; level: string; coarsened: boolean } | null =
      null;
    const offers = [];
    for (const o of b.offers.slice(0, 2)) {
      const emp = o.employer ? await resolveEmployer(o.employer) : null;
      const base = o.base ?? null;
      const bonus = o.bonus ?? 0;
      const query: Query = {
        ...cell,
        base,
        bonus,
        employer_id: emp?.id ?? null,
        employer_name: emp?.display_name ?? null,
      };
      const r = await benchmark(query);
      if (r.status === 'ok' && !market) {
        market = { n: r.n, distribution: r.distribution, level: r.level, coarsened: r.coarsened };
      }
      const ben = await benefitsAddOn(query);
      const benefits_total = ben?.benefits_total ?? 0;
      offers.push({
        label: o.label ?? null,
        employer_name: emp?.display_name ?? null,
        base,
        bonus,
        benefits_total,
        benefits_lines: ben?.lines ?? [],
        total_comp: (base || 0) + bonus + benefits_total,
        base_percentile: r.status === 'ok' ? r.base_percentile : null,
      });
    }

    const cellLabel = [cell.role_family, cell.clearance_tier, cell.metro, cell.yoe_band]
      .filter(Boolean)
      .join(' · ');
    return Response.json({ ok: true, cell: cellLabel, market, offers });
  } catch {
    return Response.json({ ok: false, error: 'data service unavailable' }, { status: 503 });
  }
};
