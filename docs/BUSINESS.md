# Business & Go-to-Market

> How to replicate ClearanceJobs' recruiter-license revenue while winning on the
> one thing the incumbent structurally cannot fix: an **active, candidate-
> controlled pool**. The cleared comp + total-rewards intelligence is the
> engagement engine that keeps candidates coming back — which is exactly what
> makes the pool worth paying for.

**Status:** Strategy / GTM. Companion to `STRATEGY.md`, `SECURITY.md`,
`INTAKE.md`, `MARKETPLACE.md`, `JOBS.md`, `CONTRACT-INTELLIGENCE.md`.
**Last updated:** 2026-07.

---

## 0. Thesis in one line

> Don't out-**size** ClearanceJobs' candidate pool — out-**engage** it. Sell
> recruiters access to candidates who are *actually looking and actually
> respond*, kept warm by comp/benefits intelligence they return for, under a
> consent-gated model that puts candidates in control.

## 1. How ClearanceJobs works (the incumbent)

- **Candidates pay nothing.** Tens of thousands of resumes — a deep, rich
  repository, increasingly AI-driven for search/matching.
- **Employers pay the license.** ~**$12,000/yr = one recruiter seat**, giving
  **unlimited candidate search + direct outreach**. This resume-database access
  is the core revenue, not (primarily) job postings.
- **Embedded in hiring workflow** via ATS integrations (e.g. Agile ATS).
- **No employer clearance verification.** CJ relies on candidate self-attestation
  backed by federal law: lying about holding a clearance is a crime under
  **18 U.S.C. § 1001** (up to 5 years). The legal deterrent *is* the verification.
- **Moat:** pool size, brand, employer relationships, ATS integrations, 20+ years
  of incumbency.

## 2. The incumbent's fatal flaw (our wedge)

The pool is **big but stale.** The dominant failure mode: a candidate creates an
account once and **never logs in again.** Recruiters then spend $12k seats
head-hunting profiles that are dormant, mis-priced, or no longer looking →
**low response rates → wasted spend.** ClearanceJobs has no mechanism that
signals *who is actually looking and reachable right now.*

That gap is the whole opportunity.

## 3. The inversion: an active, candidate-controlled pool

Four moves, each the opposite of CJ's posture:

1. **Candidates are the customer, not the inventory.** They come for value
   (comp/benefits truth), not to be sold.
2. **Comp intelligence is the engagement engine.** "Am I underpaid? Is this offer
   good? Where do I sit vs the market?" is a *recurring* question — a reason to
   log in monthly, not once. This keeps the pool warm (single-player utility;
   see §6).
3. **Liveness is the product.** A candidate is shown as **"active / available"**
   only if they've engaged recently (login or an explicit monthly "still
   looking?" confirmation). Recruiters can filter for **active-in-last-30-days**
   — a guarantee CJ cannot make.
4. **Consent-gated reveal** (`MARKETPLACE.md`): recruiters search anonymized
   cards, request intros, and reach the candidate only on the candidate's
   approval. Control stays with the candidate.

Net: a **smaller but dramatically more responsive** pool.

## 4. Why an active pool beats a big pool — economically

A recruiter's real metric is **hires per seat**, which is driven by **response
rate**, not raw candidate count.

> A 5,000-candidate pool at a 40% response rate outperforms a 50,000-candidate
> pool at 3% — and costs the recruiter the same seat.

Because our pool is engagement-gated, we can **measure and even advertise
response rates** — a sales weapon CJ structurally lacks (they have no engagement
mechanism to point to). We sell *outcomes*, not *volume*.

## 5. Keeping the pool active — the engagement mechanism

Your instinct that candidates should have "skin in the game" is right; the design
question is *how* to get engagement without killing the liquidity we depend on.

- **Do NOT paywall discoverability.** Charging candidates to be *listed* shrinks
  the pool — the exact asset recruiters pay for. Liquidity is the moat; don't tax
  it.
- **DO gate "active/available" status on recent activity.** Status decays if the
  candidate doesn't log in / confirm within ~30 days. This *structurally* fixes
  CJ's "never logs in" problem: dormant candidates simply drop out of the active
  set instead of polluting it.
- **The carrot and the gate work together.** The comp intelligence makes
  candidates *want* to log in; the activity-gate makes staleness *cost* them
  visibility. No coercion needed.
- **Optional premium candidate tier** (revenue + engagement, never a gate on the
  core pool): deeper comp cuts, offer-negotiation insights, priority placement.
  This captures your "a little bit of money keeps them engaged" idea *without*
  suppressing liquidity — payment buys *power features*, activity buys
  *visibility*.

**Key open decision (see §12):** is "active" a login, or an explicit "still
looking" toggle? The toggle is a stronger recruiter signal (intent, not just
presence) and is likely the better product.

## 6. The intelligence layer — differentiator *and* moat

The candidate hook, the engagement engine, and the data moat are the **same
asset**: proprietary cleared comp + total-rewards data.

- **Cleared total-comp percentiles.** Base+bonus percentile (from crowdsourced
  comp submissions + talent-card comp bands) **joined to** the benefits valuation
  we already built → a *true total-comp* percentile by **role × clearance tier ×
  metro × experience band**. "Your base is 30th percentile, but your benefits add
  22%, so your total comp is 45th." No one offers this for the cleared niche.
- **Why it's a moat:** CJ has jobs + browsing, not candidate-trusted comp truth;
  Levels.fyi doesn't cover cleared; Glassdoor is stale and never priced. The data
  compounds with every submission and can't be bought.
- **Sources we already have:** the intake (extend to capture comp), talent cards
  (comp bands), and the benefits valuation engine. Same **k-anonymity** discipline
  as everywhere else — no cell shown below the threshold.

## 7. Revenue model & unit economics

| Line | Who pays | Basis |
| --- | --- | --- |
| **Recruiter seats** (primary) | employers | ~$12k/seat/yr, unlimited search + **consent-gated** outreach — priced at parity with CJ, sold on *active-pool response quality* |
| **Employer benefits + comp benchmarking** | employers' total-rewards & capture teams | subscription on the **anonymous aggregate** + contract-shape intelligence (§14); warm-lead synergy with recruiting |
| **Consumer report unlock** (primary B2C) | candidates | one-time deep total-comp + benefits rack-and-stack + negotiation brief (§13) — a *power feature*, not a visibility paywall |
| **Candidate premium** (optional) | candidates | power features only; **never** required to be listed |

> Detailed pricing: **§13** (direct-to-consumer) and **§14** (B2B contract
> intelligence). The consumer report and the B2B benchmark are the **same
> dataset** sold to two audiences (`CONTRACT-INTELLIGENCE.md` §6).

Unit-economics logic: **candidate CAC is low** (the free comp tool is an organic/
SEO magnet, the way CJ's job listings pull traffic); **recruiter LTV is high and
sticky** *if response rates hold*, which is exactly what the engagement mechanism
protects. A handful of design-partner employers at $12k validates the model
before scale.

## 8. Verification — match CJ's bar, add optional trust

- **Match CJ:** self-attested clearance **tier**, backed by the **18 U.S.C.
  § 1001** deterrent. No employer verification required — the same legal
  accountability CJ already relies on.
- **Add optional trust badges on the marketplace side only.** Because a
  marketplace candidate has *chosen* to be identifiable, we can offer stronger,
  direct verification there (work-email domain, LinkedIn) for a "verified" badge
  — raising recruiter trust **without touching the benefits-anonymity wall.**
- **The asymmetry is deliberate:** benefits side = *verify-and-forget /
  unlinkable* (`SECURITY.md` §3); marketplace side = candidate opted into being
  identifiable, so stronger verification is fine and never links back to benefits
  data (`MARKETPLACE.md` §1).

## 9. Cold-start & GTM sequence

The single-player comp tool is what breaks the two-sided chicken-and-egg:

1. **Phase 1 — Seed candidates (single-player).** Free comp/benefits intelligence.
   Distribute in cleared communities (r/SecurityClearance, Blind, cleared-hiring
   events, word of mouth). Builds the data *and* the pool with zero recruiters
   present. *(This is what we have been building.)*
2. **Phase 2 — Turn on the marketplace.** Talent cards + consent-gated reveal,
   once a metro/role has enough **active** candidates to clear k-anonymity.
3. **Phase 3 — Sell recruiter seats.** Lead with **active-pool response metrics**
   + total-comp intelligence to design-partner employers.
4. **Phase 4 — Upsell employer benchmarking.**

**Beachhead:** pick 1–2 dense cleared metros (DC/NoVA, Huntsville, Colorado
Springs, San Antonio) and 1–2 role families (software, sysadmin, intel analyst)
to hit comp-liquidity and pool density fast, rather than spreading thin.

## 10. Moat map — where we're thin, where we win

| | ClearanceJobs | Us |
| --- | --- | --- |
| Pool **size** | ✅ huge | ❌ smaller (by design) |
| Pool **liveness / response** | ❌ stale | ✅ active, measurable |
| Candidate **trust / control** | ❌ exposed | ✅ consent-gated |
| Comp / total-rewards **intelligence** | ❌ none candidate-facing | ✅ cleared total-comp percentiles |
| Brand / employer relationships | ✅ 20+ yrs | ❌ to earn |
| ATS + compliance stack | ✅ **owns AgileATS** (OFCCP/EEO/AAP) | ➖ integrate, don't replicate |

We don't beat incumbency frontally; we win a **wedge** — cleared candidates who
care about comp truth and privacy — then expand.

### 10.1 Competitive intelligence (live walkthrough, 2026-07)

Observed directly on clearancejobs.com:

- **CJ is a vertically integrated GovCon hiring stack, not just a job board.**
  Sibling brands share a top nav: **ClearanceJobs** (marketplace) · **AgileATS**
  (their own applicant tracking system, agile-ats.com) · **PSG**. AgileATS does
  AI candidate ranking, resume parsing, Boolean search, a **prime↔subcontractor
  hiring portal**, and — critically — **OFCCP / EEO-1 / EEO-2 / AAP compliance**
  (legally mandatory for federal contractors; NIST 800-171 + SOC 2). Candidates
  flow from CJ into the employer's AgileATS pipeline.
  - *Implication:* the moat is **workflow + compliance lock-in**, not just pool
    size. → **We integrate, we don't replicate.** Be a sourcing + intelligence
    layer that feeds *into* whatever ATS an employer runs (incl. AgileATS).
    Building our own ATS + OFCCP/EEO/AAP compliance suite early is a huge,
    regulated distraction. Stay top-of-funnel; win on pool liveness + comp data.

- **"ClearanceJobs Premium" — a paid *candidate* tier — is now live.** Pitch:
  "You've got the clearance, now get the visibility." Benefits: show up to more
  recruiters, **salary insights ("get the scoop on salaries")**, see who viewed
  your profile, **"stay hidden when you need to,"** boost recruiter trust, retain
  access to closed jobs. 7-day free trial.
  - *Implication (double-edged):* validates that candidates will pay — **and**
    CJ is already bolting on our exact differentiators (salary insight, control)
    as a **paywalled upsell**. Our durable edge must be that comp intelligence is
    the **free core hook** and control is **structural**, not a premium toggle.

- **The staleness thesis is visible in the product.** A real dormant candidate
  dashboard showed **0 profile views**, old connections with **0 recent
  activity**, and weeks-old "top matching jobs" — with basic engagement feedback
  (who viewed you) **blurred behind Premium**. CJ has no mechanism that keeps a
  candidate active; that gap is our wedge (§2–§5).

- **Framing:** CJ leads with **job volume + employer pre-screening** ("69,675
  jobs from 1,781 pre-screened companies"), and the recruiter/pricing product is
  gated (sales-contact, not public list price — consistent with the ~$12k/seat
  figure coming from direct experience, not a public page).

## 11. Risks & honest tensions

- **Liquidity per cell.** A smaller active pool must still be deep enough per
  metro/role to justify a seat. → Beachhead focus.
- **Recruiter appetite for consent-gated.** Recruiters like open browsing. → Sell
  on response quality; consider a hybrid early if adoption stalls.
- **Comp-data liquidity for percentiles.** Percentiles need ≥ k submissions per
  cell before they're compelling — the same seeding challenge, one layer down.
- **Incumbent response.** CJ could bolt on engagement features; our durable edge
  is the candidate-trust posture + proprietary comp data, both structurally hard
  for a recruiter-first incumbent to copy.
- **Charging candidates at all.** Even a small fee risks the liquidity flywheel;
  keep payment on *power features*, not visibility (see §5).

## 12. Open decisions

- "Active" = login vs explicit **"still looking" toggle** (recommend the toggle).
- Activity-gate window (30 days?) and how status decays.
- Premium candidate tier — feature set and price.
- Recruiter seat price/tiers, contract length, and whether to bundle benchmarking.
- Beachhead metro(s) + role families to launch.
- ATS integration priority (parity table-stakes for recruiter adoption).
- Whether recruiters get "active" as a hard filter or a ranking boost.

## 13. Direct-to-consumer comp/benefits product & pricing

The comp intelligence is both the free engagement hook (§6) **and** a paid
product in its own right. Willingness-to-pay concentrates at **money-on-the-line
moments** — evaluating an offer, prepping a counter, deciding whether to jump
contracts — where a small fee sits against a $10–40k/yr decision.

| Tier | Price | What it is |
| --- | --- | --- |
| **Free** (give-to-get) | $0 | Single market percentile + verdict. The hook and the data flywheel. **Never gates visibility** (§5). |
| **Report unlock** ⭐ | **$29–39 one-time** | Full total-comp + benefits **rack-and-stack** + contract-shape context + **negotiation brief** for *your* situation (`CONTRACT-INTELLIGENCE.md` §7). The workhorse SKU. |
| **Comp Watch** | **~$12–15/mo or $99/yr** | Ongoing tracking for your cell, alerts when the market moves, unlimited offer comparisons. For the actively-searching minority. |

- **Ideal middle ground: lead with the one-time unlock.** Cleared professionals
  change contracts every ~2–3 years, so a per-event $29 captures the acute
  willingness-to-pay without demanding a subscription they'll churn out of. The
  annual is the "you'll be back" upsell, not the front door. **Don't overprice
  the sub** — a set-and-forget tracker churns hard.
- **Why these numbers:** consumer/prosumer ceiling. $29 is impulse against a
  five-figure decision; $99/yr is considered. Above that needs enterprise
  justification — which is §14.
- **Consistent with §5:** the report unlock buys *depth/power*, never
  *visibility*. Contributing data unlocks the free percentile; paying unlocks the
  deep analysis — flywheel and revenue in one loop.

## 14. B2B contract-intelligence product & pricing

The highest-ACV product. Buyers: **comp/total-rewards teams, capture/BD, and TA**
at cleared employers. All sold on the **anonymous aggregate** — contract-*shape*,
never named contracts or people (`CONTRACT-INTELLIGENCE.md` §1, §5).

| Product | Price | Basis |
| --- | --- | --- |
| **Comp + benefits benchmarking** | **~$15–50k/yr** per company (six figures for large primes) | dashboard + data access to canonical-LCAT × clearance × metro comp and total-rewards benchmarks; scales with size / seats / depth |
| **Capture / BD labor-rate intelligence** | premium tier or **per-proposal** | market + awarded (CALC) rates by canonical LCAT × customer sector × metro for bid pricing — tied directly to proposal economics, so the **highest willingness-to-pay** |
| **Recruiter seats** | ~$12k/seat/yr (§7) | consent-gated outreach to the active pool |

**Differentiation (why us, recap of §10 + `CONTRACT-INTELLIGENCE.md` §6):**

- vs. **Radford / Mercer / WTW** comp surveys — generic-tech, annual,
  HR-self-reported, no cleared premium. We're cleared-specific, real-time,
  bottoms-up, **LCAT-granular**. Nobody has clean cleared-labor comp at that grain.
- vs. **ClearanceJobs** — sourcing (resumes), no candidate-trusted comp truth.
  Adjacent, not head-on; our wedge is comp/benefits *intelligence*.
- vs. **Glassdoor / Levels** — consumer, noisy, not cleared, no dollarization.
- **The moat is the flywheel:** crowdsourced comp + benefits + ingested postings +
  public rate data → one compounding cleared dataset competitors can't buy. B2B
  monetizes the exact dataset the consumer flywheel builds — *two products, one
  wall* (`MARKETPLACE.md` §7).

**Sequencing:** consumer + flywheel first (builds the moat, cheap CAC); jobs +
CALC ingest thickens the dataset so k-anonymity clears and B2B can launch sooner
(`JOBS.md`); B2B benchmarking is the monetization once density holds.

---

*Next: I can walk ClearanceJobs live (browser) to pull concrete UI/feature detail
for the marketplace build, and prototype the comp-benchmark engine (total-comp
percentiles) on top of the existing valuation layer.*
