'use client';
import type { Dist } from '@/lib/types';

const usd = (n?: number | null) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());
const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const BAND: Record<string, string> = {
  below: 'var(--color-below)',
  slightly_below: 'var(--color-below)',
  at: 'var(--color-at)',
  above: 'var(--color-above)',
  strong: 'var(--color-above)',
};

/** The signature instrument: a market-pay distribution track with the user's
 *  position marked. Not color-only — the percentile is stated in the chip. */
export function PercentileTrack({
  dist,
  you,
  band,
  animate = true,
}: {
  dist: Dist;
  you?: number | null;
  band?: string;
  animate?: boolean;
}) {
  const min = dist.p25 * 0.8,
    max = dist.p90 * 1.08,
    span = Math.max(max - min, 1);
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  const c = (band && BAND[band]) || 'var(--color-at)';
  const youL = you != null ? Math.max(6, Math.min(94, pos(you))) : null;

  return (
    <div>
      {/* your chip (above the track) */}
      {you != null && (
        <div className="relative h-6">
          <div
            className={`absolute -translate-x-1/2 ${animate ? 'reveal' : ''}`}
            style={{ left: `${youL}%` }}
          >
            <div
              className="tnum whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: c, color: 'var(--color-ink)' }}
            >
              YOU {usd(you)}
            </div>
            <div
              className="absolute left-1/2 top-full h-1.5 w-px -translate-x-1/2"
              style={{ background: c }}
            />
          </div>
        </div>
      )}

      {/* the track */}
      <div className="relative h-16 overflow-hidden rounded-xl bg-ink-2 ring-1 ring-line">
        {/* interquartile "typical range" band, brand-tinted */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${pos(dist.p25)}%`,
            right: `${100 - pos(dist.p75)}%`,
            background: 'linear-gradient(180deg, rgba(61,139,255,0.14), rgba(53,208,214,0.10))',
          }}
        />
        {/* quartile edges */}
        <div
          className="absolute inset-y-0 w-px bg-line-2/60"
          style={{ left: `${pos(dist.p25)}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-line-2/60"
          style={{ left: `${pos(dist.p75)}%` }}
        />
        {/* median (market midpoint) */}
        <div
          className="absolute inset-y-0 w-0.5"
          style={{
            left: `${pos(dist.p50)}%`,
            background: 'linear-gradient(180deg,var(--color-brand),var(--color-brand-2))',
            opacity: 0.85,
          }}
        />
        {/* your position marker */}
        {you != null && (
          <div
            className={`absolute inset-y-0 -translate-x-1/2 ${animate ? 'reveal' : ''}`}
            style={{
              left: `${pos(you)}%`,
              width: 3,
              background: c,
              boxShadow: `0 0 12px ${c}, 0 0 0 2px var(--color-ink-2)`,
            }}
          />
        )}
      </div>

      {/* percentile legend */}
      <div className="tnum mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        <span className="text-faint">
          <span className="text-faint/60">p25</span> {usd(dist.p25)}
        </span>
        <span className="text-muted">
          <span className="brand-grad font-medium">median</span> {usd(dist.p50)}
        </span>
        <span className="text-faint">
          <span className="text-faint/60">p75</span> {usd(dist.p75)}
        </span>
        <span className="text-faint">
          <span className="text-faint/60">p90</span> {usd(dist.p90)}
        </span>
      </div>
    </div>
  );
}

export { usd, ord };
