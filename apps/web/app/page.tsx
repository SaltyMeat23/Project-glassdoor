'use client';
import { useEffect, useState } from 'react';
import { PercentileTrack, usd, ord } from '@/components/PercentileTrack';
import { ModeToggle } from '@/components/ModeToggle';
import { EmployerPicker } from '@/components/EmployerPicker';
import type { Benchmark, Meta } from '@/lib/types';

const CLEAR_LABEL: Record<string, string> = {
  none: 'None / Public Trust',
  secret: 'Secret',
  ts: 'Top Secret',
  ts_sci: 'TS/SCI',
  ts_sci_poly: 'TS/SCI + Poly',
};
const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const bandText = (b?: string) =>
  b === 'below' || b === 'slightly_below' ? 'text-below' : b === 'at' ? 'text-at' : 'text-above';

const emptyForm = {
  role: '',
  clearance: 'ts_sci',
  metro: 'dc_metro',
  yoe: '',
  base: '',
  bonus: '',
  employer: '',
  prime_sub: '',
  customer: '',
  lcat: '',
};

export default function Page() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [f, setF] = useState({ ...emptyForm });
  const [res, setRes] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [refine, setRefine] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/comp/meta')
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
    // Preselect the employer when arriving from a company profile's "Contribute"
    // CTA (/?employer=<slug>).
    const slug = new URLSearchParams(window.location.search).get('employer');
    if (slug) setF((s) => ({ ...s, employer: slug }));
  }, []);

  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = async () => {
    setErr('');
    if (!f.clearance || !f.yoe || !f.base) {
      setErr('Add at least clearance, years of experience, and base pay.');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/comp/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(f),
      }).then((x) => x.json());
      setRes(r);
    } catch {
      setRes({ ok: false, error: "Couldn't reach the market data service." });
    }
    setLoading(false);
  };

  const L = (t: string) => (
    <span className="mb-1.5 block text-[12px] font-medium text-muted">{t}</span>
  );
  const inputCls =
    'w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-brand/70';

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24">
      {/* hero */}
      <header className="pt-14 pb-9">
        <p className="font-mono text-[11px] tracking-[0.22em] text-brand-2/90">
          CLEARED TOTAL-COMP INTELLIGENCE
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-[52px]">
          Know where you stand — <span className="brand-grad">before you sign.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          See how your cleared pay and benefits compare to the market — anonymously, and built from
          real cleared professionals. No account, no name.
        </p>
        <div className="mt-7">
          <ModeToggle />
        </div>
      </header>

      <div className="grid items-start gap-4 md:grid-cols-2">
        {/* profile form */}
        <section className="rounded-2xl border border-line bg-panel p-6">
          <h2 className="mb-5 font-display text-base font-semibold">Your profile</h2>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="col-span-2">
              {L('Role / title')}
              <input
                list="roles"
                className={inputCls}
                placeholder="e.g. SIGINT Analyst, Software Engineer"
                value={f.role}
                onChange={(e) => set('role', e.target.value)}
              />
              <datalist id="roles">
                {[
                  'Software Engineer',
                  'Systems Engineer',
                  'SIGINT Analyst',
                  'All-Source Intelligence Analyst',
                  'Cybersecurity Engineer',
                  'DevOps Engineer',
                  'Data Scientist',
                  'Program Manager',
                  'Systems Administrator',
                  'Network Engineer',
                ].map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div>
              {L('Clearance')}
              <select
                className={inputCls}
                value={f.clearance}
                onChange={(e) => set('clearance', e.target.value)}
              >
                {(meta?.clearance_tiers ?? ['ts_sci']).map((c) => (
                  <option key={c} value={c}>
                    {CLEAR_LABEL[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {L('Metro')}
              <select
                className={inputCls}
                value={f.metro}
                onChange={(e) => set('metro', e.target.value)}
              >
                {(meta?.metros ?? ['dc_metro']).map((m) => (
                  <option key={m} value={m}>
                    {titleize(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {L('Years of experience')}
              <input
                type="number"
                min={0}
                max={45}
                className={inputCls}
                placeholder="7"
                value={f.yoe}
                onChange={(e) => set('yoe', e.target.value)}
              />
            </div>
            <div>
              {L('Employer (optional)')}
              <EmployerPicker
                value={f.employer}
                onChange={(slug) => set('employer', slug)}
                inputCls={inputCls}
                placeholder="Search employers… (optional)"
              />
            </div>
            <div>
              {L('Base salary ($)')}
              <input
                type="number"
                className={`${inputCls} tnum`}
                placeholder="150000"
                value={f.base}
                onChange={(e) => set('base', e.target.value)}
              />
            </div>
            <div>
              {L('Bonus ($, optional)')}
              <input
                type="number"
                className={`${inputCls} tnum`}
                placeholder="12000"
                value={f.bonus}
                onChange={(e) => set('bonus', e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRefine((v) => !v)}
            className="mt-4 text-[13px] text-muted transition-colors hover:text-brand-2"
          >
            {refine ? '– ' : '+ '}Refine by contract{' '}
            <span className="text-faint">(pay varies most by contract)</span>
          </button>
          {refine && (
            <div className="mt-3 grid grid-cols-2 gap-3.5">
              <div>
                {L('Prime / Sub')}
                <select
                  className={inputCls}
                  value={f.prime_sub}
                  onChange={(e) => set('prime_sub', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="prime">Prime</option>
                  <option value="sub">Sub</option>
                </select>
              </div>
              <div>
                {L('Customer')}
                <select
                  className={inputCls}
                  value={f.customer}
                  onChange={(e) => set('customer', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="dod">DoD</option>
                  <option value="ic">Intel Community</option>
                  <option value="civilian">Civilian</option>
                </select>
              </div>
              <div className="col-span-2">
                {L('Labor category / level')}
                <input
                  className={inputCls}
                  placeholder="e.g. Engineer III, Senior"
                  value={f.lcat}
                  onChange={(e) => set('lcat', e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="brand-fill mt-6 w-full rounded-lg py-3 font-display font-semibold text-brand-ink transition hover:brightness-110 active:brightness-95 disabled:opacity-60"
          >
            {loading ? 'Comparing…' : 'See how I compare'}
          </button>
          {err && <p className="mt-2 text-[13px] text-below">{err}</p>}
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            Your entry joins the anonymous pool that powers everyone&apos;s benchmark — no account,
            no name, coarse month only.
          </p>
        </section>

        {/* market position */}
        <section className="min-h-[380px] rounded-2xl border border-line bg-panel p-6">
          <h2 className="mb-5 font-display text-base font-semibold">Market position</h2>
          <Readout res={res} you={Number(f.base) || null} bonus={Number(f.bonus) || 0} />
        </section>
      </div>
    </main>
  );
}

function Readout({
  res,
  you,
  bonus,
}: {
  res: Benchmark | null;
  you: number | null;
  bonus: number;
}) {
  if (!res) {
    return (
      <div className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden text-center">
        <div className="grid-motif pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-line-2 font-mono text-brand-2">
            %
          </div>
          <p className="max-w-[280px] text-sm text-muted">
            Enter your profile to see where your pay and total comp sit against the cleared market.
          </p>
        </div>
      </div>
    );
  }
  if (!res.ok && res.error) return <p className="text-sm text-below">{res.error}</p>;
  if (res.status === 'insufficient') {
    return (
      <div className="reveal">
        <p className="font-display text-[15px] font-semibold">Not enough data yet</p>
        <p className="mt-2 text-sm text-muted">
          Only <span className="tnum text-text">{res.have}</span> submissions for{' '}
          <span className="text-text">{res.cell}</span> — we need{' '}
          <span className="tnum text-text">{res.k}</span> before showing a figure, so no one is
          identifiable.
        </p>
        <p className="mt-3 text-sm text-muted">
          Your entry was recorded anonymously. Come back as the cell fills — or share ContractIQ
          with a colleague on your contract.
        </p>
      </div>
    );
  }

  const v = res.verdict;
  const total = (you ?? 0) + bonus + (res.benefits?.benefits_total ?? 0);
  return (
    <div className="reveal">
      {v && (
        <p className={`font-display text-xl font-semibold leading-snug ${bandText(v.band)}`}>
          {v.text}
        </p>
      )}

      <div className="mt-7">
        <PercentileTrack dist={res.distribution!} you={you} band={v?.band} />
      </div>

      <p className="mt-7 text-sm text-muted">
        You&apos;re at the{' '}
        <span className={`tnum font-semibold ${bandText(v?.band)}`}>
          {res.base_percentile != null ? ord(res.base_percentile) : '—'} percentile
        </span>{' '}
        for base pay
        {res.total_cash_percentile != null && (
          <>
            {' '}
            · <span className="tnum text-text">{ord(res.total_cash_percentile)}</span> for total
            cash
          </>
        )}
        .
      </p>
      <p className="mt-1 text-[12px] text-faint">
        Based on <span className="tnum">{res.n}</span> anonymous datapoints
        {res.approximate ? ' (small sample — approximate)' : ''}
        {res.coarsened ? (
          <>
            {' '}
            · widened to <span className="text-muted">{res.level}</span> to protect anonymity
          </>
        ) : null}
        .
      </p>

      {res.benefits && (
        <div className="mt-6 border-t border-line pt-5">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              + Benefits{' '}
              {res.benefits.employer ? `(${res.benefits.employer})` : '(sector benchmark)'}
            </span>
            <span className="tnum font-semibold">{usd(res.benefits.benefits_total)}/yr</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {res.benefits.lines.map((l, i) => (
              <div key={i} className="flex justify-between text-[13px] text-muted">
                <span>
                  {l.label} <span className="text-faint">[{l.confidence}]</span>
                </span>
                <span className="tnum">{usd(l.value)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-display font-semibold">Total-rewards value</span>
            <span className="tnum brand-grad font-display text-lg font-bold">{usd(total)}/yr</span>
          </div>
        </div>
      )}
    </div>
  );
}
