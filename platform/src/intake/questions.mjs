// The intake question set — the big decision drivers, asked as confirm/correct.
// Ordered; each maps to a plan_terms term_key the valuation engine reads.
// `medical_premium_employer_pct_*` directly captures the "employer pays X% of
// the premium" pattern (incl. "100% covered") — the gap scraping can't fill.

export const QUESTIONS = [
  { term_key: 'k401_match', label: '401(k) match — max % of salary your employer matches', input: 'pct', unit: 'pct' },
  { term_key: 'k401_auto_contribution', label: '401(k) automatic (non-elective) employer contribution, % of salary', input: 'pct', unit: 'pct' },
  { term_key: 'medical_premium_employer_pct_single', label: '% of the EMPLOYEE-ONLY medical premium your employer pays (e.g. 100)', input: 'pct', unit: 'pct' },
  { term_key: 'medical_premium_employer_pct_family', label: '% of the FAMILY medical premium your employer pays', input: 'pct', unit: 'pct' },
  { term_key: 'hsa_employer', label: 'Employer HSA contribution — family, $/year', input: 'money', unit: 'usd_per_year' },
  { term_key: 'pto', label: 'PTO days per year (entry / minimum accrual)', input: 'days', unit: 'days' },
  { term_key: 'paid_holidays', label: 'Paid company holidays per year', input: 'days', unit: 'days' },
  { term_key: 'tuition_reimbursement', label: 'Annual tuition / education reimbursement cap, $', input: 'money', unit: 'usd_per_year' },
  { term_key: 'parental_leave', label: 'Paid parental leave, weeks', input: 'weeks', unit: 'weeks' },
  { term_key: 'schedule_9_80', label: 'Is a 9/80 or compressed schedule offered? (1 = yes, 0 = no)', input: 'bool', unit: 'bool' },
];

export const QUESTION_BY_KEY = Object.fromEntries(QUESTIONS.map((q) => [q.term_key, q]));
