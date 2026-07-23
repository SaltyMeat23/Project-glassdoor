// Monogram fallback for company logos. Most directory companies have no logo,
// and we deliberately don't hotlink third-party logo CDNs (leaks viewer IP —
// SECURITY §8.2). A deterministic hue per company adds subtle variety.

function initials(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) => w && !/^(the|of|and|llc|inc|corp|co|group|solutions|technologies|systems)$/i.test(w)
    );
  const src = words.length ? words : name.split(/\s+/).filter(Boolean);
  const a = src[0]?.[0] ?? name[0] ?? '?';
  const b = src[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  // bias toward the brand's blue→cyan→teal arc for cohesion
  return 180 + (h % 80);
}

export function CompanyLogo({
  name,
  size = 44,
  slug,
  hasLogo,
}: {
  name: string;
  size?: number;
  slug?: string;
  hasLogo?: boolean;
}) {
  // Real logo: served from our own origin (SECURITY §8.2 — bytes self-hosted in
  // Neon), a small mark centered on a subtle chip. Monogram fallback otherwise.
  if (hasLogo && slug) {
    return (
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/companies/${encodeURIComponent(slug)}/logo`}
          alt={`${name} logo`}
          className="h-[70%] w-[70%] object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  const h = hue(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-display font-bold text-text/90"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(150deg, hsl(${h} 55% 22%), hsl(${h + 24} 50% 15%))`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 45% 40% / 0.35)`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
