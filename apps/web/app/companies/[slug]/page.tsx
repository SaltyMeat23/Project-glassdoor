import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CompanyLogo } from '@/components/CompanyLogo';
import { getCompanyProfile, type ProfileTerm } from '@/lib/engine/companies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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

      {/* benefit sections */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Section
          label="Pay"
          terms={[]}
          emptyCta={
            <Link href={`/?employer=${p.slug}`} className="text-brand-2 hover:underline">
              See how pay compares →
            </Link>
          }
        />
        <Section label="Retirement" terms={byKey.retirement ?? []} />
        <Section label="Insurance" terms={byKey.insurance ?? []} />
        <Section label="Leave" terms={byKey.leave ?? []} />
      </div>

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
