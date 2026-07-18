# Web benefit-extraction spec (for research agents)

You extract **priced U.S. employee-benefit terms** for one employer from PUBLIC
sources and write a JSON file. Follow this exactly.

## Source priority (highest value first)

1. **Employer-published total-rewards / benefits-guide PDFs** — the gold. Search
   for `"<employer> total rewards pdf"`, `"<employer> benefits guide pdf"`,
   `"<employer> 2025 OR 2026 benefits enrollment pdf"`, and the employer's own
   benefits subdomain (e.g. `benefits.<employer>.com`, `totalrewards.<employer>.com`).
2. **SEC filings** for public companies — the 401(k)/Savings Plan **Form 11-K**
   and **DEF 14A/10-K** often state the exact match formula and vesting. Search
   `"<employer> 11-K savings plan sec.gov"`.
3. **Employer careers/benefits marketing pages** — use, but they are often vague.
4. **Third-party aggregators** (Glassdoor, Levels.fyi, Built In, advisor blogs) —
   LEADS ONLY. Use to find a number, then prefer an employer/SEC source. If only a
   third-party has it, you may include it but mark `confidence: "inferred"`.

Do NOT fabricate. Only include a term you actually found with a citable source.
If the employer's careers page auto-summary conflicts with a published PDF/SEC
filing, TRUST THE PDF/SEC filing and note the discrepancy.

## Fields to extract (controlled `term_key` vocabulary)

Include a record only when found. Each record:
`{ term_key, value_num, value_text, unit, plan_year, confidence, link_plan_type, source_url, source_snippet, notes }`

- `k401_match` — 401(k) match formula. `value_num` = max % of salary matched. `unit:"pct"`. `link_plan_type:"401k"`.
- `k401_auto_contribution` — automatic/non-elective employer contribution. `value_num` = %. `unit:"pct"`. `link_plan_type:"401k"`.
- `k401_vesting` — vesting of employer contributions. `value_num` = years to full vest (0 = immediate). `unit:"years"`. `link_plan_type:"401k"`.
- `k401_eligibility` — waiting period / auto-enroll. `value_num` = days (0 = immediate). `unit:"days"`. `link_plan_type:"401k"`.
- `k401_last_day_rule` — must be employed on last day of plan year for match? `value_num` 1/0. `unit:"bool"`. `link_plan_type:"401k"`.
- `pension_db_status` — defined-benefit pension status (open / frozen / closed to new hires / none). `value_text` describes; `link_plan_type:"db_pension"`.
- `hsa_employer` — employer HSA contribution. `value_num` = headline $ (use family/max). `unit:"usd_per_year"`. Put the full tier/coverage/salary matrix in `value_text` + `notes`.
- `pto` — paid time off. `value_num` = days (use minimum/entry). `unit:"days"`.
- `paid_holidays` — `value_num` = days. `unit:"days"`.
- `parental_leave` — paid parental leave. `value_num` = weeks. `unit:"weeks"`.
- `tuition_reimbursement` — annual cap. `value_num` = USD. `unit:"usd_per_year"`.
- `schedule_9_80` — 9/80 or compressed schedule offered? `value_num` 1/0. `unit:"bool"`.
- `espp_discount` — ESPP discount. `value_num` = %. `unit:"pct"`.
- `std_max` — short-term disability max. `value_num` = weeks. `unit:"weeks"`.
- `life_insurance` — company-paid basic life. `value_num` = multiple of salary. `unit:"x_salary"`.

Rules:
- `confidence`: `"reported"` = explicit number from an employer-published or SEC
  source; `"inferred"` = summarized / third-party / approximate.
- `plan_year`: integer if determinable, else null.
- `source_url`: exact URL. `source_snippet`: verbatim supporting text, <= 200 chars.
- `link_plan_type`: only `"401k"` or `"db_pension"` as noted; omit otherwise.

## Output

Write the file to the EXACT path given in your task, shape:

```json
{
  "slug": "<given slug>",
  "employer": "<name>",
  "fetched_period": "2026-07",
  "sources_checked": ["url", "..."],
  "terms": [ { ...record... }, ... ]
}
```

Then reply with ONE line only: `<slug>: <N> terms (<R> reported)`. No other prose.
