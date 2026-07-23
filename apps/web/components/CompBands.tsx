// Compensation-by-clearance bands for a company profile. All tiers share one
// x-scale, so the clearance premium is visible at a glance: a higher-median tier
// sits visibly to the right. Band = middle 50% (p25–p75) of posted midpoints;
// marker = median. Derived from the employer's open postings (public data).
import type { CompTierBand } from '@/lib/engine/companies';

const TIER_LABEL: Record<string, string> = {
  none: 'Public Trust',
  secret: 'Secret',
  ts: 'Top Secret',
  ts_sci: 'TS/SCI',
  ts_sci_poly: 'TS/SCI + Poly',
};
const k = (n: number) => `$${Math.round(n / 1000)}k`;

export function CompBands({ bands }: { bands: CompTierBand[] }) {
  const lo = Math.min(...bands.map((b) => b.p25));
  const hi = Math.max(...bands.map((b) => b.p75));
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  return (
    <div>
      {/* scale header */}
      <div className="mb-3 flex items-center gap-3 text-[11px] text-faint">
        <div className="w-24 shrink-0 sm:w-28" />
        <div className="relative h-3 flex-1">
          <span className="tnum absolute left-0">{k(lo)}</span>
          <span className="tnum absolute right-0">{k(hi)}</span>
        </div>
        <div className="w-20 shrink-0 text-right sm:w-24">median · n</div>
      </div>

      <div className="space-y-3">
        {bands.map((b) => (
          <div key={b.clearance_tier} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-[13px] text-muted sm:w-28">
              {TIER_LABEL[b.clearance_tier] ?? b.clearance_tier}
            </div>
            <div
              className="relative h-6 flex-1 rounded bg-inset"
              title={`${TIER_LABEL[b.clearance_tier] ?? b.clearance_tier}: ${k(b.p25)}–${k(b.p75)} (median ${k(b.p50)}), ${b.n} postings`}
            >
              {/* interquartile band */}
              <div
                className="brand-fill absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-80"
                style={{
                  left: `${pos(b.p25)}%`,
                  width: `${Math.max(pos(b.p75) - pos(b.p25), 1.5)}%`,
                }}
              />
              {/* median marker */}
              <div
                className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-text shadow-[0_0_8px_rgba(53,208,214,0.75)]"
                style={{ left: `${pos(b.p50)}%` }}
              />
            </div>
            <div className="w-20 shrink-0 text-right sm:w-24">
              <span className="tnum text-sm text-text">{k(b.p50)}</span>
              <span className="ml-1.5 text-[11px] text-faint">{b.n.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
