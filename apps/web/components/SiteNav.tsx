'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Compare' },
  { href: '/companies', label: 'Companies' },
];

/** Rising-bars mark — the product is about where you land on the market curve. */
function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mk" x1="0" y1="22" x2="22" y2="0">
          <stop stopColor="#3d8bff" />
          <stop offset="1" stopColor="#35d0d6" />
        </linearGradient>
      </defs>
      <rect x="1" y="13" width="4.5" height="8" rx="1.4" fill="url(#mk)" opacity="0.55" />
      <rect x="8.75" y="8" width="4.5" height="13" rx="1.4" fill="url(#mk)" opacity="0.8" />
      <rect x="16.5" y="2" width="4.5" height="19" rx="1.4" fill="url(#mk)" />
    </svg>
  );
}

export function SiteNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-[18px] font-bold tracking-tight">
            Contract<span className="brand-grad">IQ</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  active ? 'bg-panel text-text' : 'text-muted hover:text-text'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <span className="ml-2 hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-above" />
            Anonymous
          </span>
        </nav>
      </div>
    </header>
  );
}
