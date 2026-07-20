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
      {/* the track */}
      <div className="relative h-14 rounded-md bg-inset ring-1 ring-line overflow-hidden">
        {/* interquartile "typical range" band */}
        <div
          className="absolute inset-y-0 bg-white/[0.055]"
          style={{ left: `${pos(dist.p25)}%`, right: `${100 - pos(dist.p75)}%` }}
        />
        {/* quartile edges */}
        <div
          className="absolute inset-y-0 w-px bg-line-2/70"
          style={{ left: `${pos(dist.p25)}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-line-2/70"
          style={{ left: `${pos(dist.p75)}%` }}
        />
        {/* median (market midpoint) */}
        <div
          className="absolute inset-y-0 w-px"
          style={{ left: `${pos(dist.p50)}%`, background: 'var(--color-accent)', opacity: 0.8 }}
        />
        {/* your position */}
        {you != null && (
          <div
            className={`absolute inset-y-0 ${animate ? 'marker-slide' : ''}`}
            style={{ left: `${pos(you)}%` }}
          >
            <div
              className="absolute inset-y-0 -translate-x-1/2"
              style={{ width: 3, background: c, boxShadow: '0 0 0 2px var(--color-ink)' }}
            />
          </div>
        )}
      </div>

      {/* your chip */}
      {you != null && (
        <div className="relative h-0">
          <div
            className={`absolute -top-[70px] -translate-x-1/2 ${animate ? 'marker-slide' : ''}`}
            style={{ left: `${youL}%` }}
          >
            <div
              className="rounded px-2 py-0.5 text-[11px] font-semibold tnum whitespace-nowrap"
              style={{ background: c, color: 'var(--color-ink)' }}
            >
              YOU {usd(you)}
            </div>
          </div>
        </div>
      )}

      {/* percentile legend — inline so labels never collide */}
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tnum">
        <span className="text-faint">
          <span className="text-faint/60">p25</span> {usd(dist.p25)}
        </span>
        <span className="text-muted">
          <span className="text-accent/90">median</span> {usd(dist.p50)}
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
