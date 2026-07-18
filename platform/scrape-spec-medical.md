# Medical-premium extraction spec (focused pass)

You extract **only medical/health premium employer-contribution** data for one
employer, from PUBLIC sources, and write a JSON file. This closes the biggest
gap in the valuation engine.

## What we want

How much of the **medical premium** the EMPLOYER pays (vs. the employee), by
coverage tier. Cleared-industry employers frequently advertise that they cover
**100% of the employee-only premium** (and a portion of dependent premiums) —
capture exactly that.

## Source priority

1. Employer-published **benefits-guide / total-rewards PDFs** and **enrollment
   rate sheets** (often contain a premium table: employee cost + employer cost
   per tier). Search `"<employer> medical premium 2025 OR 2026 pdf"`,
   `"<employer> benefits guide pdf"`, `"<employer> employee contributions medical"`.
2. Employer careers/benefits pages that state "we pay X% of premiums" or "100%
   employer-paid medical."
3. Third-party (Glassdoor/Levels/Comparably/advisor blogs) — LEADS ONLY; mark
   `confidence:"inferred"`.

Do NOT fabricate. Omit any field you cannot source.

## Fields (controlled `term_key` vocabulary)

Each record: `{ term_key, value_num, value_text, unit, plan_year, confidence, source_url, source_snippet, notes }`.

Percent form (preferred when the source says "% covered" / "100% paid"):
- `medical_premium_employer_pct_single` — % of the EMPLOYEE-ONLY premium the employer pays. `value_num` = percent (e.g. 100). `unit:"pct"`.
- `medical_premium_employer_pct_family` — % of the FAMILY premium the employer pays. `unit:"pct"`.

Dollar form (preferred when the source gives actual dollars):
- `medical_employer_premium_single` — employer's ANNUAL $ toward the employee-only premium. `unit:"usd_per_year"`.
- `medical_employer_premium_family` — employer's ANNUAL $ toward the family premium. `unit:"usd_per_year"`.

Optional context (capture if present, helps verify):
- `medical_employee_premium_single` — the EMPLOYEE's annual cost, employee-only. `unit:"usd_per_year"`.
- `medical_employee_premium_family` — the EMPLOYEE's annual cost, family. `unit:"usd_per_year"`.

Derivation rules:
- "Employer pays 100% of employee premium" → `medical_premium_employer_pct_single = 100` (`reported`).
- Premium table gives monthly employee + employer amounts → compute ANNUAL employer $ (×12) for the tier → dollar-form key.
- Table gives total premium + employee cost → employer $ = total − employee (annualized).
- Only employee cost is shown, no total/employer → put it in `medical_employee_premium_*` and note the gap; do not guess the employer share.
- If tiers are "employee+spouse" or "employee+children", map the richest/family-like tier to `*_family` and note which tier it was.

`confidence`: `"reported"` = explicit employer/SEC number; `"inferred"` = third-party/approximate.
`source_url` + `source_snippet` (<=200 chars) REQUIRED for every record. `plan_year` if known.

## Output

Write to the EXACT path given, shape:
```json
{ "slug": "<given slug>", "employer": "<name>", "fetched_period": "2026-07",
  "sources_checked": ["url", "..."], "terms": [ { ...record... } ] }
```
Then reply with ONE line only: `<slug>: <N> medical terms (<R> reported)`.
