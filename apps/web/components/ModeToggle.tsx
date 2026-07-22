'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MODES = [
  { href: '/', label: 'You vs. the market' },
  { href: '/compare', label: 'Two offers' },
];

export function ModeToggle() {
  const path = usePathname();
  return (
    <div className="inline-flex rounded-xl border border-line bg-inset p-1 text-sm">
      {MODES.map((m) => {
        const active = path === m.href;
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              active ? 'brand-fill text-brand-ink' : 'text-muted hover:text-text'
            }`}
          >
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}
