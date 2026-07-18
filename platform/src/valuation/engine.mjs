// Valuation engine — converts an employer's plan_terms + a user profile into
// per-benefit annual dollar values, each with its basis, assumptions, and
// confidence (STRATEGY.md §3). v1 focuses on the big decision drivers: pay,
// 401(k), PTO, and medical/dental/vision.
//
// Honesty rules:
//  - Only value what we have employer-specific data for; otherwise use a clearly
//    labeled benchmark and mark data_status so gaps are visible, not hidden.
//  - Every line carries confidence + source so trust is earned, not asserted.

import { ASSUMPTIONS, CONFIDENCE_RANK } from './assumptions.mjs';

const round = (n) => (n == null ? null : Math.round(n));

/** Load the best plan_terms row per term_key for an employer. */
export function loadTerms(db, employerId) {
  const rows = db.prepare(
    'SELECT term_key, value_num, value_text, unit, confidence, plan_year, source_url FROM plan_terms WHERE employer_id = ?',
  ).all(employerId);
  const best = new Map();
  for (const r of rows) {
    const cur = best.get(r.term_key);
    if (!cur) { best.set(r.term_key, r); continue; }
    const better =
      (CONFIDENCE_RANK[r.confidence] ?? 0) > (CONFIDENCE_RANK[cur.confidence] ?? 0) ||
      ((CONFIDENCE_RANK[r.confidence] ?? 0) === (CONFIDENCE_RANK[cur.confidence] ?? 0) &&
        (r.plan_year ?? 0) > (cur.plan_year ?? 0));
    if (better) best.set(r.term_key, r);
  }
  return best;
}

function line(key, label, value, { confidence = 'missing', basis = '', source_url = null, plan_year = null, note = '', data_status = 'ok' } = {}) {
  return { key, label, value: round(value), confidence, basis, source_url, plan_year, note, data_status };
}

// ---- individual benefit valuations ----------------------------------------

function value401k(profile, terms) {
  const out = [];
  const s = profile.salary;
  const match = terms.get('k401_match');
  if (match && match.value_num != null) {
    out.push(line('k401_match', '401(k) employer match', s * (match.value_num / 100), {
      confidence: match.confidence, source_url: match.source_url, plan_year: match.plan_year,
      basis: `${match.value_num}% of salary`,
      note: 'Assumes you contribute enough to receive the full match.',
    }));
  }
  const auto = terms.get('k401_auto_contribution');
  if (auto && auto.value_num != null) {
    out.push(line('k401_auto_contribution', '401(k) automatic employer contribution', s * (auto.value_num / 100), {
      confidence: auto.confidence, source_url: auto.source_url, plan_year: auto.plan_year,
      basis: `${auto.value_num}% of salary`,
      note: 'Non-elective — paid regardless of your contribution.',
    }));
  }
  // vesting caveat (does not change v1 value, but is surfaced)
  const vest = terms.get('k401_vesting');
  if (vest && vest.value_num > 0 && out.length) {
    out[0].note += ` Employer contributions vest over ~${vest.value_num} year(s).`;
  }
  return out;
}

function valuePTO(profile, terms) {
  const out = [];
  const daily = profile.salary / ASSUMPTIONS.working_days_per_year;
  const pto = terms.get('pto');
  if (pto && pto.value_num != null) {
    out.push(line('pto', 'Paid time off', pto.value_num * daily, {
      confidence: pto.confidence, source_url: pto.source_url, plan_year: pto.plan_year,
      basis: `${pto.value_num} days × $${round(daily)}/day`,
      note: 'PTO days are typically entry/minimum accrual; rises with tenure.',
    }));
  }
  const hol = terms.get('paid_holidays');
  if (hol && hol.value_num != null) {
    out.push(line('paid_holidays', 'Paid holidays', hol.value_num * daily, {
      confidence: hol.confidence, source_url: hol.source_url, plan_year: hol.plan_year,
      basis: `${hol.value_num} days × $${round(daily)}/day`,
    }));
  }
  return out;
}

function valueHealth(profile, terms) {
  const out = [];
  const fam = profile.family_status === 'family' ? 'family' : 'single';

  // Employer HSA contribution — employer-specific where we have it.
  const hsa = terms.get('hsa_employer');
  if (hsa && hsa.value_num != null) {
    // value_num is generally the family/headline figure; note when single.
    const note = fam === 'single'
      ? 'Stored figure is typically the family/headline amount; single is usually lower.'
      : '';
    out.push(line('hsa_employer', 'Employer HSA contribution', hsa.value_num, {
      confidence: hsa.confidence, source_url: hsa.source_url, plan_year: hsa.plan_year,
      basis: hsa.value_text || `$${hsa.value_num}/yr`, note,
    }));
  }

  // Employer medical premium share — the DATA GAP. Use a labeled benchmark.
  const empPrem = terms.get('medical_employer_premium');
  if (empPrem && empPrem.value_num != null) {
    out.push(line('medical_employer_premium', 'Employer medical premium share', empPrem.value_num, {
      confidence: empPrem.confidence, source_url: empPrem.source_url, plan_year: empPrem.plan_year,
      basis: empPrem.value_text || `$${empPrem.value_num}/yr`,
    }));
  } else {
    out.push(line('medical_employer_premium', 'Employer medical premium share', ASSUMPTIONS.benchmark_employer_health_premium[fam], {
      confidence: 'benchmark', data_status: 'benchmark',
      basis: `KFF 2024 avg employer ${fam} premium`,
      note: 'NOT employer-specific — top data gap; scrape/crowdsource target.',
    }));
  }

  // Dental/vision — small; benchmark unless we have it.
  out.push(line('dental_vision', 'Employer dental/vision share', ASSUMPTIONS.benchmark_employer_dental_vision[fam], {
    confidence: 'benchmark', data_status: 'benchmark',
    basis: `benchmark employer ${fam} dental+vision`,
    note: 'Benchmark placeholder until valued per-employer.',
  }));

  return out;
}

// ---- top-level -------------------------------------------------------------

/**
 * Value an employer's total rewards for a profile.
 * Returns { employer, profile, cash, lines, subtotals, gaps }.
 */
export function valuate(db, employer, profile) {
  const terms = loadTerms(db, employer.id);
  const lines = [
    ...value401k(profile, terms),
    ...valuePTO(profile, terms),
    ...valueHealth(profile, terms),
  ];

  const specific = lines.filter((l) => l.data_status === 'ok').reduce((n, l) => n + (l.value || 0), 0);
  const benchmark = lines.filter((l) => l.data_status === 'benchmark').reduce((n, l) => n + (l.value || 0), 0);
  const benefits_total = specific + benchmark;

  const gaps = lines.filter((l) => l.data_status === 'benchmark').map((l) => l.label);

  return {
    employer: { slug: employer.slug, name: employer.display_name, ownership: employer.ownership },
    profile,
    cash: round(profile.salary),
    lines,
    subtotals: {
      cash: round(profile.salary),
      benefits_employer_specific: round(specific),
      benefits_benchmark: round(benchmark),
      benefits_total: round(benefits_total),
      total_comp: round(profile.salary + benefits_total),
    },
    gaps,
  };
}
