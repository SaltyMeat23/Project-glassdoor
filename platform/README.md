# ContractIQ Platform — data foundation

The data layer for **ContractIQ** (see
[`../docs/STRATEGY.md`](../docs/STRATEGY.md) and
[`../docs/SECURITY.md`](../docs/SECURITY.md)). This is Phase 0–1: the real data
model plus a **Form 5500** ingest that seeds the top ~40 cleared-defense
employers with verified public data — solving cold-start before anyone submits.

> The old React/`json-server` app in `../src` is the discarded Glassdoor-clone
> reference. Nothing here depends on it.

## What it does

1. Downloads the DOL EFAST2 **Form 5500** annual dataset (public, bulk CSV).
2. Attributes each filing to a curated employer by EIN or normalized sponsor
   name, classifies the plan from its benefit codes, and loads it into SQLite.
3. Reports coverage per employer and plan-type mix.

Form 5500 proves a plan **exists** and its **scale** (participant counts,
whether a DB pension exists, whether a 401(k) is present, whether large-plan
financials are on file). It does **not** carry the priced terms (exact match %,
HSA seed, PTO accrual) — those come later from SEC filings, union CBAs, and
crowdsourced submissions. That is why `plan_terms` is empty after seeding.

## Coverage matters, not just public companies

Form 5500 is filed by **essentially every private-sector ERISA benefit plan —
public or private.** The seed run matches privately held primes and nonprofits
(General Atomics, Anduril, Palantir, Peraton, ManTech, Sierra Nevada; Battelle,
The Aerospace Corporation, MITRE, JHU APL, Draper) right alongside the public
companies. The only employers it does **not** cover are government agencies
(federal/state — ERISA-exempt) and churches. SEC 10-K/proxy filings are the
public-company-only source, used later purely to extract match formulas.

## Run it

```sh
cd platform
npm install
npm run seed          # download + ingest + report (default plan year 2023)
# or step by step:
npm run download 2023
npm run ingest 2023   # accepts multiple years: npm run ingest 2022 2023
npm run report
```

Requires Node ≥ 22.5 (uses built-in `node:sqlite`). No native builds. Output DB
is `platform/benefits.db` (git-ignored, regenerable).

### Valuation engine

Convert an employer's `plan_terms` + a user profile into dollar-valued total
rewards (STRATEGY §3). Focuses on the big decision drivers: pay, 401(k), PTO,
and medical/dental/vision. Every line exposes its basis + confidence; benefits
we lack employer-specific data for are shown as a **labeled benchmark**, never
hidden.

```sh
# value one employer
npm run value -- lockheed-martin --salary 130000 --family --contrib 10
# compare two (the core consumer surface)
npm run compare -- rtx booz-allen-hamilton --salary 130000 --family
# profiles: --profile baseline-single|baseline-family ; --single/--family ; --contrib <pct>
```

Medical premium *employer share* is the current data gap — valued via a KFF
benchmark and flagged as the top scrape/crowdsource target.

## Layout

```
db/schema.sql            data model (STRATEGY §5), SECURITY.md constraints baked in
data/employers.seed.json curated ~40 cleared employers + name-match aliases
src/download.mjs         fetch + cache EFAST2 zips
src/ingest.mjs           stream-parse CSV, match, classify, upsert
src/report.mjs           coverage + plan-type summary
src/lib/efast.mjs        EFAST2 download/extract
src/lib/normalize.mjs    sponsor-name normalization + employer matching
src/lib/benefit-codes.mjs Form 5500 pension/welfare code classification
src/lib/db.mjs           node:sqlite wrapper (portable SQL -> Postgres later)
```

## Security posture (see `../docs/SECURITY.md`)

The schema encodes the hard constraints from day one: `submission` has **no**
`user_id`/account back-reference and only a **coarse** period (never a precise
timestamp); no table holds a real name, email, SSN, IP, or clearance id. The
Form 5500 data is company-level public information and carries no personal data.

## Next steps

- Ingest **Schedule H** (`F_SCH_H`) and **Schedule R** (`F_SCH_R`) to attach
  large-plan financials and retirement-plan detail to matched plans.
- Add known **EINs** to `employers.seed.json` to catch subsidiaries whose names
  don't start with the parent (e.g. GDIT under General Dynamics).
- Layer SEC 10-K/DEF 14A extraction to fill `plan_terms` (match formulas).
- Build the crowdsourced-submission path (doc-backed, PII-scrubbed) per
  `SECURITY.md`, writing to `plan_terms` + `submission`.
- Stand up the valuation engine (STRATEGY §3) that reads `plan_terms` + a
  `valuation_profile` and returns per-benefit dollar values.
