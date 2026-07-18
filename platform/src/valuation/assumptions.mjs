// Valuation assumptions — every default here is exposed in output so users can
// see and (later) tune them (STRATEGY.md §3: "expose its assumptions").

export const ASSUMPTIONS = {
  // Working days used to convert a salary into a daily rate for PTO valuation.
  working_days_per_year: 260,

  // Benchmarks used ONLY as a clearly-labeled fallback when we lack employer-
  // specific data. Source: KFF Employer Health Benefits Survey 2024, average
  // ANNUAL employer premium contribution (rounded). NOT employer-specific.
  benchmark_employer_health_premium: { single: 7000, family: 17500 },
  benchmark_employer_dental_vision: { single: 400, family: 900 },
};

// Default profiles (the "baseline" a user starts from and then tunes).
export const DEFAULT_PROFILES = {
  'baseline-single': {
    label: 'baseline-single',
    salary: 120000,
    family_status: 'single',
    contribution_rate: 0.10, // fraction of salary contributed to 401(k)
    health_usage_tier: 'medium',
  },
  'baseline-family': {
    label: 'baseline-family',
    salary: 150000,
    family_status: 'family',
    contribution_rate: 0.10,
    health_usage_tier: 'medium',
  },
};

// Confidence ranking for choosing the best plan_terms row per key.
export const CONFIDENCE_RANK = { verified: 3, reported: 2, inferred: 1, benchmark: 0, missing: -1 };
