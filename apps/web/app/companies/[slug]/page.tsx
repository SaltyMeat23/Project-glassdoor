import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CompanyLogo } from '@/components/CompanyLogo';
import { getCompanyProfile, type ProfileTerm, type OpenRole } from '@/lib/engine/companies';
import { CompBands } from '@/components/CompBands';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Only ever render http(s) links (stored source URLs are employer careers pages).
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

const CLEARANCE_LABEL: Record<string, string> = {
  none: 'Public Trust',
  secret: 'Secret',
  ts: 'Top Secret',
  ts_sci: 'TS/SCI',
  ts_sci_poly: 'TS/SCI + Poly',
};
const clearanceLabel = (t: string | null) =>
  t ? (CLEARANCE_LABEL[t] ?? titleize(t)) : 'Clearance req’d';

function payBand(r: OpenRole): string | null {
  if (r.salary_max == null) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  return r.salary_min != null
    ? `${k(r.salary_min)}–${k(r.salary_max)}`
    : `up to ${k(r.salary_max)}`;
}

const TERM_LABEL: Record<string, string> = {
  k401_match: '401(k) match',
  k401_auto_contribution: '401(k) auto contribution',
  k401_vesting: '401(k) vesting',
  k401_eligibility: '401(k) eligibility',
  k401_last_day_rule: '401(k) last-day rule',
  k401_contribution_range: '401(k) contribution range',
  pension_db_status: 'Pension (defined benefit)',
  esop: 'ESOP',
  hsa_employer: 'Employer HSA contribution',
  medical_premium_employer_pct_single: 'Employer premium % (single)',
  medical_premium_employer_pct_family: 'Employer premium % (family)',
  medical_employer_premium_single: 'Employer premium (single)',
  medical_employer_premium_family: 'Employer premium (family)',
  medical_employee_premium_single: 'Employee premium (single)',
  medical_employee_premium_family: 'Employee premium (family)',
  pto: 'Paid time off',
  paid_holidays: 'Paid holidays',
  parental_leave: 'Parental leave',
  std_max: 'Short-term disability',
};

const UNIT: Record<string, (n: number) => string> = {
  pct: (n) => `${n}%`,
  usd_per_year: (n) => `$${Math.round(n).toLocaleString()}/yr`,
  days: (n) => `${n} days`,
  weeks: (n) => `${n} wks`,
  years: (n) => `${n} yr`,
  bool: (n) => (n ? 'Yes' : 'No'),
};

function termValue(t: ProfileTerm): string {
  if (t.value_text) return t.value_text;
  if (t.value_num == null) return '—';
  return Math.round(t.value_num).toLocaleString();
}

const BADGE: Record<string, string> = {
  verified: 'text-above border-above/40',
  reported: 'text-brand-2 border-brand-2/40',
  inferred: 'text-muted border-line-2',
  benchmark: 'text-faint border-line',
};

function Section({
  label,
  terms,
  emptyCta,
}: {
  label: string;
  terms: ProfileTerm[];
  emptyCta?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 font-display text-base font-semibold">{label}</h2>
      {terms.length === 0 ? (
        <p className="text-sm text-muted">No data yet.{emptyCta ? <> {emptyCta}</> : null}</p>
      ) : (
        <div className="space-y-2">
          {terms.map((t) => (
            <div key={t.term_key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">{TERM_LABEL[t.term_key] ?? titleize(t.term_key)}</span>
              <span className="flex items-baseline gap-2">
                <span className="tnum text-text">{termValue(t)}</span>
                <span
                  className={`rounded-full border px-1.5 py-px text-[10px] ${BADGE[t.confidence] ?? 'text-faint border-line'}`}
                >
                  {t.confidence}
                  {t.plan_year ? ` ${t.plan_year}` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getCompanyProfile(slug).catch(() => null);
  if (!p) notFound();

  const byKey = Object.fromEntries(p.groups.map((g) => [g.key, g.terms]));
  // Only ever render http(s) links — a javascript:/data: URL in the DB would
  // otherwise execute on click (stored XSS). Guards every source of `website`.
  const safeWebsite = p.website && /^https?:\/\//i.test(p.website) ? p.website : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24">
      <div className="pt-8">
        <Link
          href="/companies"
          className="text-[13px] text-muted transition-colors hover:text-brand-2"
        >
          ← All companies
        </Link>
      </div>

      {/* header */}
      <header className="mt-5 flex items-start gap-4">
        <CompanyLogo name={p.display_name} size={64} />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
            {p.display_name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {p.industry && <span>{titleize(p.industry)}</span>}
            {p.sector && <span className="text-faint">· {titleize(p.sector)}</span>}
            {safeWebsite && (
              <a
                href={safeWebsite}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-brand-2 hover:underline"
              >
                Website ↗
              </a>
            )}
          </p>
        </div>
      </header>

      {p.about && (
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">{p.about}</p>
      )}

      {/* compensation — the headline: pay by clearance, from this employer's postings */}
      {p.comp_bands.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="font-display text-lg font-semibold">Compensation</h2>
            <span className="text-[11px] text-faint">
              from <span className="tnum text-muted">{p.comp_posting_count.toLocaleString()}</span>{' '}
              posted pay ranges
            </span>
          </div>
          <p className="mb-5 max-w-xl text-[13px] leading-relaxed text-muted">
            Typical base pay by clearance level — the median (marker) and middle 50% (band) of this
            employer&apos;s open postings that list a salary.
          </p>
          <CompBands bands={p.comp_bands} />
          <div className="mt-5 border-t border-line pt-4">
            <Link
              href={`/?employer=${p.slug}`}
              className="text-[13px] font-medium text-brand-2 hover:underline"
            >
              See how your pay compares at {p.display_name} →
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-display text-lg font-semibold">Compensation</h2>
          <p className="mt-1.5 text-sm text-muted">
            No posted pay ranges yet.{' '}
            <Link href={`/?employer=${p.slug}`} className="text-brand-2 hover:underline">
              See how your pay compares →
            </Link>
          </p>
        </section>
      )}

      {/* benefits */}
      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Benefits</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Section label="Retirement" terms={byKey.retirement ?? []} />
        <Section label="Insurance" terms={byKey.insurance ?? []} />
        <Section label="Leave" terms={byKey.leave ?? []} />
      </div>

      {/* open roles — live cleared postings from the employer's careers site */}
      {p.open_roles_total > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">Open cleared roles</h2>
            <span className="text-[12px] text-faint">
              <span className="tnum text-muted">{p.open_roles_total.toLocaleString()}</span> open
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line">
            {p.open_roles.map((r, i) => {
              const href = safeUrl(r.source_url);
              const band = payBand(r);
              const inner = (
                <>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text">{r.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                      <span className="rounded-full border border-brand-2/40 px-1.5 py-px text-[10px] text-brand-2">
                        {clearanceLabel(r.clearance_tier)}
                      </span>
                      {r.location_raw && <span className="truncate">{r.location_raw}</span>}
                      {r.remote && <span className="text-faint">· Remote</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {band ? (
                      <span className="tnum text-sm text-text">{band}</span>
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </div>
                </>
              );
              const cls =
                'flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0';
              return href ? (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={`${cls} transition-colors hover:bg-panel-2`}
                >
                  {inner}
                </a>
              ) : (
                <div key={i} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Live cleared postings from the employer&apos;s careers site
            {p.open_roles_total > p.open_roles.length
              ? ` — showing ${p.open_roles.length} of ${p.open_roles_total.toLocaleString()}`
              : ''}
            . Pay bands shown where the posting lists one.
          </p>
        </section>
      )}

      {/* contribute */}
      <div className="mt-6 rounded-2xl border border-line bg-panel-2 p-6 text-center">
        <p className="font-display text-lg font-semibold">Know {p.display_name}&apos;s package?</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Add what you know — anonymously, no account. Every contribution sharpens the benchmark for
          everyone on your contract.
        </p>
        <Link
          href={`/?employer=${p.slug}`}
          className="brand-fill mt-4 inline-block rounded-lg px-6 py-2.5 font-display font-semibold text-brand-ink transition hover:brightness-110"
        >
          Contribute anonymously
        </Link>
      </div>
    </main>
  );
}
