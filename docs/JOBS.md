# Job & Contract Data Ingest

> How we acquire live cleared-role data at scale — and why that pipeline is
> secretly a **comp-data pipeline**. Job postings and public contract-award data
> are **employer-published, non-PII facts**: they describe a *requisition or an
> awarded rate*, never a person. That makes them the safe path to
> contract-grade comp intelligence (`CONTRACT-INTELLIGENCE.md`) without touching
> the anonymity wall (`SECURITY.md`).

**Status:** Design spec. Companion to `STRATEGY.md`, `CONTRACT-INTELLIGENCE.md`,
`BUSINESS.md`. **Last updated:** 2026-07.

---

## 0. Why this is high-leverage

Two payoffs from one pipeline:

1. **Engagement.** An "Open roles" section turns the mostly-empty company
   directory into live, recurring content — a reason to return, and the on-ramp
   to the marketplace (`BUSINESS.md` §3).
2. **Comp density.** Every posting carrying a salary band (increasingly common
   under pay-transparency law) becomes a `comp_datapoint` with `source='posting'`
   — filling the benchmark **without** waiting on crowdsourced give-to-get, which
   is our slowest input. Jobs ingest is comp ingest wearing a job-board costume.

## 1. It's ~6 adapters, not 1,700 scrapers

Almost every cleared employer runs its careers page on a handful of applicant
tracking systems, each with a **structured JSON feed** behind the HTML. We write
one adapter per ATS, not one scraper per company.

| Source | Endpoint shape | Typical coverage |
| --- | --- | --- |
| **Workday** | `POST /wday/cxs/{tenant}/{site}/jobs` (paginated JSON) | Large primes (Leidos, SAIC, Booz-tier) |
| **Greenhouse** | `boards-api.greenhouse.io/v1/boards/{token}/jobs` | Defense-tech / mid-market |
| **Lever** | `api.lever.co/v0/postings/{co}?mode=json` | Smaller shops |
| **Ashby / SmartRecruiters / iCIMS** | public `/postings` JSON | Startups, mid-market |
| **USAJOBS** | `api.usajobs.gov` (real API key) | Federal / gov-adjacent |

**Explicitly out of scope:** scraping ClearanceJobs or other aggregators —
ToS-hostile, adversarial, and strategically foolish against the incumbent we're
positioning against (`BUSINESS.md` §1). We pull from **employer-owned careers
feeds and public government data only.**

## 2. Public contract & rate data (the non-PII goldmine)

These are the safest, most B2B-lucrative sources — public, factual, and already
contract-level, with **zero person linkage**:

- **~~GSA CALC~~ — DECOMMISSIONED (verified 2026-07-23).** The Contract-Awarded
  Labor Category tool once published awarded hourly rates by labor category, but
  `calc.gsa.gov` now 301-redirects to a static page (`buy.gsa.gov/calc.html`) and
  the `/api/rates/` endpoint is gone. **There is no live public API for
  contract-awarded labor rates.** The underlying GSA Schedule rate data may be
  recoverable from the archived open dataset (the tool was 18F/calc, open-source)
  or GSA Advantage/eLibrary, but that's a research task, not an API call.
  **Practical consequence: job postings became our primary public-pay source**
  (they turned out rich — thousands of banded cleared roles), which fills the
  role CALC was meant to. The canonical-LCAT ontology seeds from contract-vehicle
  catalogs + postings instead (`CONTRACT-INTELLIGENCE.md` §3).
- **USAspending.gov** (`api.usaspending.gov`, live) — federal award data: who won
  which contract, ceiling values, place of performance, NAICS/PSC codes,
  prime↔sub. **Metadata, not pay** — it maps the **contract landscape by
  attributes** (customer/agency, prime/sub, metro, period), the structural
  skeleton contract-shape intelligence hangs on, but carries no labor rates.
- **SAM.gov / FPDS** — award and vehicle metadata for the same purpose.
- **Contract-vehicle LCAT catalogs** (OASIS, SeaPort-NxG, agency IDIQs) —
  semi-standardized labor-category definitions that anchor the ontology.

## 3. The pipeline

```
① ATS detection (one-time)  employer.website → /careers → detect ATS → ats_source
② Per-ATS adapters          feed JSON → normalized job_posting rows
③ Structured extraction     regex (clearance) + Haiku (LCAT, YOE, salary band)
④ Public-data ingest        CALC / USAspending / USAJOBS → rates + contract attrs
⑤ Scheduled refresh         cron (~daily): upsert by req_id, expire closed reqs
⑥ Fan-out                   → "Open roles" on profiles  +  comp_datapoint(source)
```

- **`ats_source`** — `employer_id → ats_type + tenant/token/site params`.
  Populated once by a detection crawl (reuse the enrichment infra: we already
  have every employer's website).
- **`job_posting`** — normalized: `employer_id, title, canonical_lcat, metro,
  clearance_tier, salary_min, salary_max, remote, posted_period, source_url,
  req_id, customer_sector?, prime_sub?`. Note the columns mirror the comp cell.
- **Structured extraction** — deterministic regex for clearance keywords
  (Secret / TS / TS-SCI / CI-poly / full-scope poly); a **Haiku pass** (same
  pattern as the description enrichment) for LCAT mapping, YOE, and salary-band
  parsing from JD text. Cheap, grounded, resumable.
- **Store fields + a source link; never republish the full JD prose.** Facts
  (title, clearance, metro, band) aren't copyrightable; the description text is.
  We keep structured fields and deep-link to the employer's posting.

## 4. Privacy posture (why this is clean)

Job/contract data is **employer data, not candidate data.** A posting is a
public requisition; a CALC row is a public awarded rate. Neither is linked to a
person, so **none of this touches `SECURITY.md`'s anonymity wall.**

- Lives in its **own tables** (`job_posting`, `ats_source`, `contract_rate`),
  with **no foreign key** to any anonymous submission table.
- A single posting is shown **as an open role**, never dressed up as "the market
  rate" — market stats are always aggregated cells (`CONTRACT-INTELLIGENCE.md`
  §4). This keeps employer-published bands from becoming a re-identification
  side-channel when a req is unique.
- No crowdsourced person-submitted data enters this pipeline; the two never join.

## 5. Product surface

- **`/companies/[slug]` → "Open roles (N)"** — live postings with clearance,
  metro, and comp band, plus **market context** ("$140–175k posted · market p50
  for this cell is $158k"). The intelligence layer on top of the listing is the
  differentiator vs. a plain job board.
- **Comp benchmark** silently thickens as postings + CALC flow in — the same
  cells the consumer hero and the B2B benchmark read.

## 6. First slice (when we build)

Smallest real version that proves the pipeline **and** starts feeding comp:

1. ATS-detection crawl over the 1,641 enriched employers.
2. **One** adapter end-to-end (Greenhouse is simplest; Workday is highest-value).
3. `job_posting` table + Haiku band/LCAT extraction.
4. "Open roles" section on the profile, scoped to cleared roles.
5. Wire posting salary bands → `comp_datapoint(source='posting')`.

Then add CALC ingest (public, high-value, no adapter fragility) and a second ATS.

## 7. Open questions

- ATS-detection accuracy / re-detection cadence (careers stacks change).
- Clearance-role classification precision (avoid ingesting non-cleared reqs).
- Refresh frequency vs. cost; how long to retain expired postings for trend data.
- CALC/USAspending join keys → canonical LCAT (`CONTRACT-INTELLIGENCE.md` §3).
- Whether "Open roles" links out or (later) funnels into the marketplace.
