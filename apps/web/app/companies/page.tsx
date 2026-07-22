'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompanyTile } from '@/components/CompanyTile';
import { DATA_ICONS } from '@/components/DataIcons';
import type { CompanyTileRow } from '@/lib/engine/companies';

export default function CompaniesPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CompanyTileRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (query: string, pageNum: number, append: boolean) => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/companies?q=${encodeURIComponent(query)}&page=${pageNum}`).then(
        (x) => x.json()
      );
      if (mine !== seq.current) return; // stale response
      setTotal(r.total ?? 0);
      setRows((prev) => (append ? [...prev, ...(r.companies ?? [])] : (r.companies ?? [])));
    } catch {
      if (mine === seq.current && !append) setRows([]);
    }
    if (mine === seq.current) setLoading(false);
  }, []);

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      load(q, 0, false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const more = () => {
    const next = page + 1;
    setPage(next);
    load(q, next, true);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24">
      <header className="pt-14 pb-7">
        <p className="font-mono text-[11px] tracking-[0.22em] text-brand-2/90">
          THE CLEARED EMPLOYER DIRECTORY
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-[52px]">
          Companies
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Browse cleared-defense employers. The icons show what we know so far — pay, retirement,
          insurance, and leave. Most fill in as cleared professionals contribute.
        </p>
      </header>

      {/* search + legend */}
      <div className="sticky top-16 z-20 -mx-5 border-b border-line bg-ink/85 px-5 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[240px] flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search 1,700+ cleared employers…"
              className="w-full rounded-lg border border-line bg-inset py-2.5 pl-9 pr-3 text-sm text-text outline-none transition-colors focus:border-brand/70"
            />
          </div>
          <div className="hidden items-center gap-4 text-[11px] text-faint sm:flex">
            {DATA_ICONS.map(({ key, label, Icon }) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="text-brand-2">
                  <Icon size={14} />
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mb-4 mt-4 text-[12px] text-faint">
        <span className="tnum text-muted">{total.toLocaleString()}</span>{' '}
        {q ? `matching “${q}”` : 'companies'}
      </p>

      {rows.length === 0 && !loading ? (
        <div className="grid-motif rounded-2xl border border-line py-16 text-center text-muted">
          No companies match “{q}”.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((c) => (
            <CompanyTile key={c.slug} c={c} />
          ))}
        </div>
      )}

      {rows.length < total && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={more}
            disabled={loading}
            className="rounded-lg border border-line-2 bg-panel px-6 py-2.5 text-sm font-medium text-muted transition-colors hover:text-text disabled:opacity-60"
          >
            {loading ? 'Loading…' : `Load more (${(total - rows.length).toLocaleString()} left)`}
          </button>
        </div>
      )}
    </main>
  );
}
