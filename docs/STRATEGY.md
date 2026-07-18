# ContractIQ — Strategy & Architecture

> A total-compensation intelligence platform for the U.S. cleared defense workforce
> (contractiq.io). Where Glassdoor *lists* benefits and job boards *hide* pay, ContractIQ
> *values the whole package* — pay percentiles plus each benefit as an annual dollar figure —
> so a candidate can tell, **before signing**, whether an offer is true to the market.

**Status:** Planning document. No product code depends on this yet.
**Owner:** repo maintainer.
**Last updated:** 2026-07.

---

## 1. Problem

Cleared professionals change employers frequently, rotating among a small set of
primes and integrators (Lockheed Martin, Northrop Grumman, RTX, Boeing, General
Dynamics, L3Harris, BAE Systems, SAIC, Leidos, Booz Allen Hamilton, CACI,
Peraton, ManTech, Parsons, Amentum, KBR, and the surrounding sub base). When
evaluating an offer, they can compare **base pay** easily but have no reliable way
to compare **total rewards** — the benefit package's real economic value.

Existing tools fall short:

- **Glassdoor** — benefits are stale, sparse, unstructured, and never priced. It
  tells you a plan *exists*, not what it's *worth*.
- **Levels.fyi** — strong on tech cash/equity, weak on the cleared/defense
  segment and does not deeply value non-cash benefits.
- **Comp consultancies (Mercer, Radford, Croner)** — sell benchmarks to
  employers, not to candidates, and not cleared-segment-specific.

The gap: **no dollar-valued, current, cleared-segment total-rewards comparison.**

## 2. Why the cleared segment is the right wedge

- **Small, high-trust, high-mobility market.** The same few thousand people cycle
  through the same ~40 employers. Demand for this info already circulates
  informally (ClearanceJobs, r/SecurityClearance, Blind, Discord).
- **Benefit variance is large and quantifiable** — 9/80 schedules, surviving
  defined-benefit pensions at a handful of primes, widely different 401(k) match
  formulas, HSA employer seed money, clearance-tied sign-on bonuses, education
  reimbursement, PTO accrual curves. All convert to dollars.
- **Legally clear.** Benefits/compensation information is not a trade secret, and
  employees have a protected right (NLRA §7) to discuss and share compensation.
  NDAs do not cover it. This is what makes crowdsourcing defensible.

## 3. The moat: a valuation engine, not a listing

The list of benefits is a commodity. The **model that prices them for a specific
person** is the product. Given a user profile, each benefit line becomes an annual
dollar value:

| Benefit | Valuation approach (illustrative) |
| --- | --- |
| 401(k) match | `f(salary, match_formula, assumed_contribution)` |
| Defined-benefit pension | actuarial estimate from formula + tenure assumptions |
| HSA employer contribution | flat employer $ (single vs. family) |
| Health premium | employer share vs. employee cost delta at a usage assumption |
| 9/80 / alternate schedule | extra days off × daily rate (~10 days ≈ ~4% of comp) |
| PTO / holidays | accrued days × daily rate |
| Education reimbursement | capped annual $ (utilization-weighted) |
| Sign-on / clearance bonus | amortized over expected tenure |

Every output must **expose its assumptions** (salary, family status, contribution
rate, health usage) so users trust the number and can tune it. That transparent,
tunable dollar figure is what powers both the consumer tool and the B2B pitch.

## 4. Data acquisition strategy (tiered)

Public data gives **breadth and credibility cheaply**; crowdsourcing gives
**depth**; employers give **first-party accuracy** and revenue. Sequence matters —
lead with Tier 1 to solve cold-start before asking anyone to submit.

### Tier 1 — Public structured data (seed coverage, do first)

- **DOL Form 5500 filings (EFAST2).** The highest-leverage public asset. Every
  ERISA benefit plan files annually; filings are public and bulk-downloadable.
  Yields, per employer: which plans exist, participant counts, whether a
  defined-benefit pension exists, and (Schedule H, large plans) plan financials.
  It does **not** give the exact match %, but it verifies plan existence and scale
  for every major cleared employer — instant breadth and a credibility anchor.
- **SEC 10-K and DEF 14A (proxy) filings** for public primes — retirement plan
  descriptions, sometimes match formulas, executive benefit structures.
- **Union contracts (IAM, UAW).** Several defense manufacturing sites are
  unionized; their CBAs publicly enumerate benefits.
- **OPM / FEHB + GS pay tables** — the government-side baseline, so users can
  compare a contractor offer against going federal.

### Tier 2 — Crowdsourced granular data (the flywheel)

The levels.fyi model, adapted. Gets the depth public data can't: exact match %,
PTO accrual, HSA seed, premium costs. To keep it trustworthy:

- Accept the primary documents users already legally hold — **SPD/SBC** (Summary
  Plan Description / Summary of Benefits & Coverage, both ERISA-required), annual
  **enrollment/benefit guides**, offer-letter benefit summaries.
- Verify submitters by **work-email domain**.
- **PII-scrub uploads server-side** on ingest — store only structured fields,
  never raw offer letters with names/SSNs.
- Tag every data point with **plan year** so freshness is a first-class field.

### Tier 3 — Direct from employers (B2B revenue + back-fill)

Comp benchmarking is already a paid industry. Primes' total-rewards teams want to
know whether their package beats a named competitor's for the same cleared role.
Sell them a benchmarking dashboard; in exchange, receive accurate first-party
data. The flywheel: consumer submissions make the B2B product credible; employer
participation makes the consumer data authoritative.

## 5. Data model (sketch)

Entities designed for valuation from the start (details to be finalized when the
schema is implemented):

- **Employer** — name, CAGE/DUNS (optional), sector, size band, public/private.
- **BenefitPlan** — belongs to Employer; `plan_type` (401k, DB pension, medical,
  dental, HSA, FSA, life, disability, PTO, schedule, tuition, bonus), `plan_year`,
  `source` (form5500 | sec | union | crowdsourced | employer), `confidence`.
- **PlanTerms** — the priced parameters per plan type (e.g. match formula, HSA
  employer $, PTO accrual schedule, schedule type). Polymorphic by `plan_type`.
- **Submission** — provenance for crowdsourced data: verification status, plan
  year, scrubbed source-doc reference. Never stores raw PII.
- **ValuationProfile** — user assumptions (salary, family status, contribution
  rate, health-usage tier) used to compute personalized dollar values.

## 6. Product surfaces

1. **Consumer comparison** — pick two (or N) employers/offers, enter a profile,
   see side-by-side dollar-valued total rewards with assumptions exposed.
2. **Employer benchmark (B2B)** — a company sees its package vs. named/anonymized
   competitors for a role/segment; the paid product.

The existing React code in this repo is a Glassdoor-clone school project
(`json-server` backend, hardcoded data, plaintext passwords). Treat it as a
**visual reference only** — the data layer is rebuilt from scratch.

## 7. Roadmap

- **Phase 0 — Foundation.** Finalize the data model + valuation methodology.
- **Phase 1 — Seed.** Ingest Form 5500 + SEC data for the top ~40 cleared
  employers. Launch with real, verified breadth before any user submits.
- **Phase 2 — Valuation engine.** Implement the profile-driven dollar model with
  transparent assumptions.
- **Phase 3 — Crowdsourcing.** Doc-backed, email-verified, PII-scrubbed
  submissions with plan-year tagging.
- **Phase 4 — B2B benchmark.** Employer dashboard; first-party data back-fill.

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| **Cold-start liquidity** — useless until it covers the companies people compare | Lead with Tier 1 public data; launch pre-populated for the top ~40 employers |
| **Freshness / stale data** (Glassdoor's failure mode) | Plan-year tagging as a first-class field; surface data age; re-ingest annually |
| **Verification / bad submissions** | Doc-backed submissions + work-email verification + confidence scoring |
| **PII exposure in uploads** | Scrub on ingest; store structured fields only; never persist raw offer letters |
| **Legal challenge to crowdsourcing** | Benefits/comp info is not a trade secret; NLRA §7 protects sharing — but keep to benefits/comp, not proprietary program info |

## 9. Open questions

- Which ~40 employers define the launch set, and in what priority order?
- Valuation defaults: what assumption set ships as the baseline profile?
- B2B pricing and data-sharing terms with the first design-partner employer.
- Handling of program/site-specific benefit variance within a single employer.
