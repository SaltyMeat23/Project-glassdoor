'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usd, ord } from '@/components/PercentileTrack';
import { ModeToggle } from '@/components/ModeToggle';
import { EmployerPicker } from '@/components/EmployerPicker';
import type { Meta } from '@/lib/types';

const CLEAR_LABEL: Record<string, string> = {
  none: 'None / Public Trust',
  secret: 'Secret',
  ts: 'Top Secret',
  ts_sci: 'TS/SCI',
  ts_sci_poly: 'TS/SCI + Poly',
};
const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type OfferIn = { label: string; employer: string; base: string; bonus: string };
type OfferOut = {
  label: string;
  employer_name: string | null;
  base: number | null;
  bonus: number;
  benefits_total: number;
  total_comp: number;
  base_percentile: number | null;
};
type CompareRes = {
  ok: boolean;
  error?: string;
  cell?: string;
  market?: { n: number; distribution: { p50: number }; coarsened?: boolean; level?: string } | null;
  offers?: OfferOut[];
};

const blankOffer = (label: string): OfferIn => ({ label, employer: '', base: '', bonus: '' });

export default function ComparePage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [p, setP] = useState({ role: '', clearance: 'ts_sci', metro: 'dc_metro', yoe: '' });
  const [offers, setOffers] = useState<OfferIn[]>([
    blankOffer('Current role'),
    blankOffer('New offer'),
  ]);
  const [res, setRes] = useState<CompareRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/comp/meta')
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
  }, []);

  const setOffer = (i: number, k: keyof OfferIn, v: string) =>
    setOffers((s) => s.map((o, j) => (j === i ? { ...o, [k]: v } : o)));

  const submit = async () => {
    setErr('');
    if (!p.clearance || !p.yoe || !offers.every((o) => o.base)) {
      setErr('Add clearance, years of experience, and a base salary for both offers.');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/comp/compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...p, offers }),
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
      <header className="pt-14 pb-9">
        <p className="font-mono text-[11px] tracking-[0.22em] text-brand-2/90">
          APPLES-TO-APPLES TOTAL COMP
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-[52px]">
          Two offers, <span className="brand-grad">side by side.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Put your current role and a new offer together — base, bonus, and{' '}
          <span className="text-text">valued benefits</span> — for a true total-comp comparison.
        </p>
        <div className="mt-7">
          <ModeToggle />
        </div>
      </header>

      {/* shared profile */}
      <section className="mb-4 rounded-2xl border border-line bg-panel p-6">
        <h2 className="mb-4 font-display text-base font-semibold">
          Your profile <span className="font-normal text-faint">(same for both)</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2 md:col-span-1">
            {L('Role / title')}
            <input
              list="roles"
              className={inputCls}
              placeholder="e.g. Software Engineer"
              value={p.role}
              onChange={(e) => setP({ ...p, role: e.target.value })}
            />
            <datalist id="roles">
              {[
                'Software Engineer',
                'Systems Engineer',
                'SIGINT Analyst',
                'Cybersecurity Engineer',
                'DevOps Engineer',
                'Data Scientist',
                'Program Manager',
                'Systems Administrator',
              ].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div>
            {L('Clearance')}
            <select
              className={inputCls}
              value={p.clearance}
              onChange={(e) => setP({ ...p, clearance: e.target.value })}
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
              value={p.metro}
              onChange={(e) => setP({ ...p, metro: e.target.value })}
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
              value={p.yoe}
              onChange={(e) => setP({ ...p, yoe: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* two offers */}
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((o, i) => (
          <section key={i} className="rounded-2xl border border-line bg-panel p-6">
            <input
              className="mb-4 w-full bg-transparent font-display text-base font-semibold outline-none focus:text-brand-2"
              value={o.label}
              onChange={(e) => setOffer(i, 'label', e.target.value)}
              aria-label={`Offer ${i + 1} label`}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                {L('Employer')}
                <EmployerPicker
                  value={o.employer}
                  onChange={(slug) => setOffer(i, 'employer', slug)}
                  inputCls={inputCls}
                  placeholder="Search employers…"
                />
              </div>
              <div>
                {L('Base salary ($)')}
                <input
                  type="number"
                  className={`${inputCls} tnum`}
                  placeholder="150000"
                  value={o.base}
                  onChange={(e) => setOffer(i, 'base', e.target.value)}
                />
              </div>
              <div>
                {L('Bonus ($)')}
                <input
                  type="number"
                  className={`${inputCls} tnum`}
                  placeholder="12000"
                  value={o.bonus}
                  onChange={(e) => setOffer(i, 'bonus', e.target.value)}
                />
              </div>
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="brand-fill mt-5 w-full rounded-lg py-3 font-display font-semibold text-brand-ink transition hover:brightness-110 active:brightness-95 disabled:opacity-60 md:w-auto md:px-10"
      >
        {loading ? 'Comparing…' : 'Compare offers'}
      </button>
      {err && <p className="mt-2 text-[13px] text-below">{err}</p>}

      {res && <Result res={res} />}
    </main>
  );
}

function Result({ res }: { res: CompareRes }) {
  if (!res.ok && res.error) return <p className="mt-4 text-sm text-below">{res.error}</p>;
  const offers = res.offers ?? [];
  if (offers.length < 2) return null;
  const [a, b] = offers;
  const winner = b.total_comp >= a.total_comp ? 1 : 0;
  const delta = Math.abs(b.total_comp - a.total_comp);
  const lead = offers[winner];

  const Row = ({
    label,
    av,
    bv,
    note,
  }: {
    label: string;
    av: ReactNode;
    bv: ReactNode;
    note?: string;
  }) => (
    <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2.5 border-t border-line items-baseline">
      <span className="text-sm text-muted">
        {label}
        {note && <span className="text-faint text-[11px]"> {note}</span>}
      </span>
      <span className="tnum text-sm text-right w-32">{av}</span>
      <span className="tnum text-sm text-right w-32">{bv}</span>
    </div>
  );

  return (
    <section className="reveal mt-6 rounded-2xl border border-line bg-panel p-6">
      <p className="font-display text-xl font-semibold">
        <span className="brand-grad">{lead.label}</span> wins on total comp — by{' '}
        <span className="tnum">{usd(delta)}/yr</span>.
      </p>
      <p className="mt-1 text-[12px] text-faint">
        {res.market ? (
          <>
            Market for {res.cell}: median{' '}
            <span className="tnum">{usd(res.market.distribution.p50)}</span> (n={res.market.n}
            {res.market.coarsened ? `, widened to ${res.market.level}` : ''}).
          </>
        ) : (
          'Not enough market data to place these on a percentile.'
        )}
      </p>

      {/* column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 mt-5 items-end">
        <span />
        {offers.map((o, i) => (
          <span key={i} className={`text-right w-32 ${winner === i ? 'text-brand' : 'text-text'}`}>
            <span className="block text-sm font-semibold truncate">{o.label}</span>
            <span className="block text-[11px] text-faint truncate">{o.employer_name ?? '—'}</span>
          </span>
        ))}
      </div>

      <div className="mt-2">
        <Row
          label="Base pay"
          av={
            <>
              {usd(a.base)}{' '}
              {a.base_percentile != null && (
                <span className="text-faint">· {ord(a.base_percentile)}</span>
              )}
            </>
          }
          bv={
            <>
              {usd(b.base)}{' '}
              {b.base_percentile != null && (
                <span className="text-faint">· {ord(b.base_percentile)}</span>
              )}
            </>
          }
          note="(percentile vs market)"
        />
        <Row label="Bonus" av={usd(a.bonus)} bv={usd(b.bonus)} />
        <Row label="Benefits (valued)" av={usd(a.benefits_total)} bv={usd(b.benefits_total)} />
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-3 border-t-2 border-line-2 items-baseline">
          <span className="text-sm font-semibold">Total comp</span>
          <span
            className={`tnum text-right w-32 font-semibold ${winner === 0 ? 'text-brand' : ''}`}
          >
            {usd(a.total_comp)}
          </span>
          <span
            className={`tnum text-right w-32 font-semibold ${winner === 1 ? 'text-brand' : ''}`}
          >
            {usd(b.total_comp)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-faint">
        Benefits are dollar-valued from each employer&apos;s plan data; [reported/inferred]
        confidence and gaps apply as on the market view.
      </p>
    </section>
  );
}
