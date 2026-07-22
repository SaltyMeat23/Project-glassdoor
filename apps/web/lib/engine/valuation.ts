// Benefits valuation — per-benefit annual dollar values from an employer's
// plan_terms + a profile. Async Neon port of platform/src/valuation/engine.mjs
// (+ assumptions.mjs). Same formulas and honesty rules (labeled benchmarks,
// data_status), so web (Neon) and platform (SQLite) value identically.
import { q } from './db';

export const ASSUMPTIONS = {
  working_days_per_year: 260,
  benchmark_employer_health_premium: { single: 7000, family: 17500 } as Record<string, number>,
  benchmark_total_premium: { single: 9000, family: 25500 } as Record<string, number>,
  benchmark_employer_dental_vision: { single: 400, family: 900 } as Record<string, number>,
};

export const CONFIDENCE_RANK: Record<string, number> = {
  verified: 3,
  reported: 2,
  inferred: 1,
  benchmark: 0,
  missing: -1,
};

const round = (n: number | null | undefined) => (n == null ? null : Math.round(n));

export type Profile = {
  salary: number;
  family_status?: string;
  contribution_rate?: number;
  health_usage_tier?: string;
};
export type Term = {
  value_num: number | null;
  value_text: string | null;
  confidence: string;
  plan_year: number | null;
  source_url: string | null;
};
export type Line = {
  key: string;
  label: string;
  value: number | null;
  confidence: string;
  basis: string;
  source_url: string | null;
  plan_year: number | null;
  note: string;
  data_status: string;
};

/** Best plan_terms row per term_key for an employer (confidence, then plan_year). */
export async function loadTerms(employerId: number): Promise<Map<string, Term>> {
  const rows = await q<Term & { term_key: string }>(
    'SELECT term_key, value_num, value_text, unit, confidence, plan_year, source_url FROM plan_terms WHERE employer_id = $1',
    [employerId]
  );
  const best = new Map<string, Term>();
  for (const r of rows) {
    const cur = best.get(r.term_key);
    if (!cur) {
      best.set(r.term_key, r);
      continue;
    }
    const better =
      (CONFIDENCE_RANK[r.confidence] ?? 0) > (CONFIDENCE_RANK[cur.confidence] ?? 0) ||
      ((CONFIDENCE_RANK[r.confidence] ?? 0) === (CONFIDENCE_RANK[cur.confidence] ?? 0) &&
        (r.plan_year ?? 0) > (cur.plan_year ?? 0));
    if (better) best.set(r.term_key, r);
  }
  return best;
}

function line(
  key: string,
  label: string,
  value: number | null,
  opts: Partial<Omit<Line, 'key' | 'label' | 'value'>> = {}
): Line {
  return {
    key,
    label,
    value: round(value),
    confidence: opts.confidence ?? 'missing',
    basis: opts.basis ?? '',
    source_url: opts.source_url ?? null,
    plan_year: opts.plan_year ?? null,
    note: opts.note ?? '',
    data_status: opts.data_status ?? 'ok',
  };
}

function value401k(p: Profile, terms: Map<string, Term>): Line[] {
  const out: Line[] = [];
  const s = p.salary;
  const match = terms.get('k401_match');
  if (match && match.value_num != null) {
    out.push(
      line('k401_match', '401(k) employer match', s * (match.value_num / 100), {
        confidence: match.confidence,
        source_url: match.source_url,
        plan_year: match.plan_year,
        basis: `${match.value_num}% of salary`,
        note: 'Assumes you contribute enough to receive the full match.',
      })
    );
  }
  const auto = terms.get('k401_auto_contribution');
  if (auto && auto.value_num != null) {
    out.push(
      line(
        'k401_auto_contribution',
        '401(k) automatic employer contribution',
        s * (auto.value_num / 100),
        {
          confidence: auto.confidence,
          source_url: auto.source_url,
          plan_year: auto.plan_year,
          basis: `${auto.value_num}% of salary`,
          note: 'Non-elective — paid regardless of your contribution.',
        }
      )
    );
  }
  const vest = terms.get('k401_vesting');
  if (vest && vest.value_num != null && vest.value_num > 0 && out.length) {
    out[0].note += ` Employer contributions vest over ~${vest.value_num} year(s).`;
  }
  return out;
}

function valuePTO(p: Profile, terms: Map<string, Term>): Line[] {
  const out: Line[] = [];
  const daily = p.salary / ASSUMPTIONS.working_days_per_year;
  const pto = terms.get('pto');
  if (pto && pto.value_num != null) {
    out.push(
      line('pto', 'Paid time off', pto.value_num * daily, {
        confidence: pto.confidence,
        source_url: pto.source_url,
        plan_year: pto.plan_year,
        basis: `${pto.value_num} days × $${round(daily)}/day`,
        note: 'PTO days are typically entry/minimum accrual; rises with tenure.',
      })
    );
  }
  const hol = terms.get('paid_holidays');
  if (hol && hol.value_num != null) {
    out.push(
      line('paid_holidays', 'Paid holidays', hol.value_num * daily, {
        confidence: hol.confidence,
        source_url: hol.source_url,
        plan_year: hol.plan_year,
        basis: `${hol.value_num} days × $${round(daily)}/day`,
      })
    );
  }
  return out;
}

function valueHealth(p: Profile, terms: Map<string, Term>): Line[] {
  const out: Line[] = [];
  const fam = p.family_status === 'family' ? 'family' : 'single';

  const hsa = terms.get('hsa_employer');
  if (hsa && hsa.value_num != null) {
    const note =
      fam === 'single'
        ? 'Stored figure is typically the family/headline amount; single is usually lower.'
        : '';
    out.push(
      line('hsa_employer', 'Employer HSA contribution', hsa.value_num, {
        confidence: hsa.confidence,
        source_url: hsa.source_url,
        plan_year: hsa.plan_year,
        basis: hsa.value_text || `$${hsa.value_num}/yr`,
        note,
      })
    );
  }

  const premUsd = terms.get(`medical_employer_premium_${fam}`);
  const premPct = terms.get(`medical_premium_employer_pct_${fam}`);
  if (premUsd && premUsd.value_num != null) {
    out.push(
      line('medical_employer_premium', 'Employer medical premium share', premUsd.value_num, {
        confidence: premUsd.confidence,
        source_url: premUsd.source_url,
        plan_year: premUsd.plan_year,
        basis: premUsd.value_text || `$${premUsd.value_num}/yr (${fam})`,
      })
    );
  } else if (premPct && premPct.value_num != null) {
    const total = ASSUMPTIONS.benchmark_total_premium[fam];
    out.push(
      line(
        'medical_employer_premium',
        'Employer medical premium share',
        (premPct.value_num / 100) * total,
        {
          confidence: premPct.confidence,
          source_url: premPct.source_url,
          plan_year: premPct.plan_year,
          basis: `${premPct.value_num}% of ${fam} premium × benchmark total $${total.toLocaleString()}`,
          note:
            premPct.value_num >= 100
              ? 'Employer pays 100% of the premium (reported); total premium amount is a benchmark.'
              : 'Employer % is reported; total premium amount is a benchmark.',
        }
      )
    );
  } else {
    out.push(
      line(
        'medical_employer_premium',
        'Employer medical premium share',
        ASSUMPTIONS.benchmark_employer_health_premium[fam],
        {
          confidence: 'benchmark',
          data_status: 'benchmark',
          basis: `KFF 2024 avg employer ${fam} premium`,
          note: 'NOT employer-specific — top data gap; scrape/crowdsource target.',
        }
      )
    );
  }

  out.push(
    line(
      'dental_vision',
      'Employer dental/vision share',
      ASSUMPTIONS.benchmark_employer_dental_vision[fam],
      {
        confidence: 'benchmark',
        data_status: 'benchmark',
        basis: `benchmark employer ${fam} dental+vision`,
        note: 'Benchmark placeholder until valued per-employer.',
      }
    )
  );

  return out;
}

export type Valuation = {
  benefits_total: number | null;
  lines: Line[];
  gaps: string[];
};

/** Value an employer's benefits for a profile. employerId null → benchmark-only. */
export async function valuate(employerId: number | null, p: Profile): Promise<Valuation> {
  const terms = employerId ? await loadTerms(employerId) : new Map<string, Term>();
  const lines = [...value401k(p, terms), ...valuePTO(p, terms), ...valueHealth(p, terms)];
  const specific = lines
    .filter((l) => l.data_status === 'ok')
    .reduce((n, l) => n + (l.value || 0), 0);
  const benchmark = lines
    .filter((l) => l.data_status === 'benchmark')
    .reduce((n, l) => n + (l.value || 0), 0);
  return {
    benefits_total: round(specific + benchmark),
    lines,
    gaps: lines.filter((l) => l.data_status === 'benchmark').map((l) => l.label),
  };
}
