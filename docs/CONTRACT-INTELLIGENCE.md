# Contract-Grade Comp Intelligence

> The most lucrative data in this market — and the hardest to get — is
> **contract-level comp**: what a *specific kind of role, on a specific kind of
> contract, for a specific customer, in a specific place* actually pays. It's
> what a candidate really wants ("what does *this* contract offer?") and what a
> B2B buyer pays most for (pricing labor on proposals, defending retention).
>
> It is also the single biggest collision with `SECURITY.md`: contract name +
> labor category + clearance + metro + a person's pay is a textbook
> re-identifier. This doc is how we deliver the value **without** creating that
> row. The resolution is not a compromise — the mechanism that makes it safe is
> the same mechanism that makes it a moat.

**Status:** Design spec. **Subordinate to `SECURITY.md`** (which takes precedence
on every conflict). Companion to `JOBS.md`, `MARKETPLACE.md`, `BUSINESS.md`.
**Last updated:** 2026-07.

---

## 0. The reframe that dissolves the tension

The instinct is that we need *"named Contract X pays $Y."* We don't — and we
must not create it. What's actually lucrative and defensible is **contract-shape
intelligence**: the economics of a *type* of contract, described by its
**attributes**, not its name.

> A capture manager pricing a bid does not want one anecdote about "SITEC II."
> They want: *"a senior GEOINT/targeting analyst, TS/SCI + poly, on an
> NSA-sector SIGINT sub-contract in the DC metro, commands $X ± band."* That
> generalizes to their bid; a single named data point does not.

Contract-shape is **more useful than the contract name** (it generalizes), and
it is **safe** (aggregated across employers, k-anonymity holds). The name is the
re-identification landmine; the shape is the gold. We build the shape.

## 1. Two lanes, one wall (the hard rule)

Contract data enters through exactly two lanes, which **never join**
(`MARKETPLACE.md` §1's wall applies verbatim):

| Lane | What it holds | Privacy basis |
| --- | --- | --- |
| **① Anonymous benchmark** | contract data **only as attributes** (customer sector, prime/sub, canonical LCAT, clearance tier, metro, period), aggregated, k-anon enforced | non-PII: postings + public rate data + *coarsened* crowdsourced. **No named contract, no person, ever.** |
| **② Consent-gated marketplace** | a candidate who **opts in** may say "I'm on [named program]" for recruiter targeting | identifiable *by choice*; walled off (`MARKETPLACE.md`), never feeds Lane ① |

**Requirement 1.1 — Named contracts exist only in Lane ②.** The anonymous
benchmark never stores or displays a program/contract *name*. A named contract
tied to a person is a marketplace fact the candidate chose to reveal, not a
benchmark row.

**Requirement 1.2 — No cross-lane key.** Same as `MARKETPLACE.md` §1.1: no shared
id, FK, or correlatable timestamp between the two lanes.

## 2. Three acquisition channels for contract-grade comp (all Lane ①-safe)

### 2.1 Job postings — employer-published, non-PII

A posting describes a **requisition**, not a person. Under pay-transparency laws
(CO/NY/CA/WA/IL) more postings carry salary bands, plus clearance and LCAT.
Because no person is linked, a posting band carries **no person→salary re-id
risk** — it is safe to ingest and aggregate. (`JOBS.md` is the pipeline.)

### 2.2 Public contract-rate data — already contract-level, already public

**GSA CALC** publishes **awarded labor-category hourly rates** from Schedule
contracts. **USAspending/FPDS** gives the contract landscape by attribute
(customer, prime/sub, place of performance, period). This is contract-level
pricing that is *public record* — the most B2B-valuable input, with zero privacy
exposure.

### 2.3 Crowdsourced submissions — kept coarse, aggregated only

Person-submitted comp carries re-id risk at fine grain, so it enters Lane ① at
**market-cell grain only** (role family × clearance tier × metro × YOE band, with
customer_sector / prime_sub / LCAT as *progressive refinements* — already in the
comp model). It contributes to aggregates; it is **never** surfaced at
named-contract grain and never as a single row.

## 3. The canonical LCAT ontology — moat *and* privacy fix in one

**The problem you named:** a "targeting officer" at one company is an
"Intelligence Analyst III" at another and a "GEOINT Targeteer" at a third —
different titles, different customers, different vehicles. Fragmented titles make
comp impossible to aggregate. That difficulty is exactly why nobody has this
data — and why it's defensible once we do.

**The solution:** a **canonical labor-category ontology** that maps
employer/customer-specific titles → normalized LCAT nodes (family + level), the
same way we already normalize `role → role_family`, but deeper and maintained.

- **Seed it from public, semi-standardized sources:** GSA CALC labor categories,
  contract-vehicle LCAT catalogs (OASIS, SeaPort, agency IDIQs), and posting text
  at scale (a Haiku pass proposes title→canonical mappings; we curate).
- **Grow it from crowdsourced "my title → what I actually do"** signals.

**Why it is simultaneously the privacy fix:** normalization **collapses many tiny
per-employer cells into one large cross-employer canonical cell.** "Targeting
Officer @ A" (n=2), "Intel Analyst III @ B" (n=3), "GEOINT Targeteer @ C" (n=1)
are each below k on their own — but the canonical node *"Targeting/GEOINT Analyst,
senior"* is n=6 and **clears k=5.** The ontology is what lets us price at fine
*economic* granularity while every displayable cell is still safely aggregate.

> The moat (nobody else can normalize fragmented cleared LCATs) and the anonymity
> guarantee (fragmented titles collapse into k-safe cells) are **the same
> mechanism.** We don't trade one for the other — building the ontology buys both.

## 4. Statistical disclosure control at contract grain (`SECURITY.md` §7)

Contract-attribute cells obey the same discipline as every other cell:

- **k-anonymity (default k=5).** Never surface a contract-shape cell below k.
- **Coarsen, don't drop below k.** When a cell (customer × canonical LCAT ×
  clearance × metro × period) is `1 < n < k`, generalize the finest attribute
  first — LCAT level → LCAT family, drop prime/sub, widen metro, widen period —
  until it clears, exactly as the market-cell coarsening ladder already does.
- **Postings vs. market stat.** A single posting is shown **as an open role**
  (employer-published, fine), never as a market statistic. Market bands are
  always the aggregated cell — this prevents a unique req from becoming a
  re-identification side-channel.
- **Noise on published aggregates** (`SECURITY.md` §7.3) for borderline cells.
- **Never a point estimate on a small cell** — always a band with n disclosed.

**Requirement 4.1 — Suppression is default; disclosure is earned by density.**
The system's bias is to show *less* granularity, coarsening up until k clears —
never to lower k to reach a finer cell.

## 5. What each side actually sees

**B2C — the candidate ("what does this contract offer?"):**

> "For your canonical role (senior GEOINT/targeting analyst), TS/SCI + poly, on
> NSA-sector contracts in the DC metro, the market band is **$142k–$178k (p50
> $159k)** — from N postings + M submissions. This open role at [Employer] posts
> **$150k–$175k** → ~**68th percentile**. Base is your lever; benefits add ~21%."

Contract-*shaped*, specific enough to act on, and safe — no name, no person, a
cell that cleared k.

**B2B — capture / comp teams:**

> "Awarded + market comp for [canonical LCAT × customer sector × metro]: market
> p50 $X, IQR $Y–$Z, from CALC awards + postings + coarsened submissions. You're
> bidding $W → 12% high; likely non-competitive on price." (Aggregate only;
> never a named-person or named-contract row.)

## 6. Why this is the differentiator (and why it's worth paying for)

- **Nobody else can produce it.** Glassdoor/Levels aren't cleared and don't
  dollarize; Radford/Mercer are generic-tech, annual, HR-self-reported;
  ClearanceJobs sells resumes, not comp truth. Contract-shape comp at canonical-
  LCAT grain requires the ontology + the multi-source join — the hard, defensible
  work.
- **It monetizes both sides from one dataset.** B2C candidates pay for the
  contract-shaped answer at a decision moment; B2B buyers pay far more for the
  aggregate market view for proposals and retention (`BUSINESS.md` §7, §13).
- **It stays honest.** The value survives *because of* the anonymity design, not
  in spite of it — the normalization that protects submitters is the same thing
  that unlocks the granularity buyers pay for.

## 7. The paid analytics surface — "why pay vs. guess elsewhere"

The free tier gives one percentile + verdict (the hook, and the give-to-get
flywheel). The **paid** surface is a **Total Rewards Terminal** — the thing a
candidate could not assemble themselves and that changes their move:

- **Total-comp dollarization, not adjectives** — waterfall (base → bonus → 401k →
  health → PTO → total), every line valued by the engine we already built.
- **Line-by-line rack-and-stack** vs. market percentiles **and a peer set you
  pick** — 401k match, vesting, PTO, parental leave, HSA, premium share — each
  color-coded above/at/below.
- **Contract-shape context** — where this role/contract-type sits, per §5.
- **A negotiation brief** — which lever to pull, with the market justification.
  This is what converts data into a purchase.

The test each paid view must pass: *"I couldn't have assembled this myself, and
it just changed what I'll do."* Dollarized total comp + cleared-specific peers +
contract-shape + a lever clears that bar; a coworker's anecdote and a stale
Glassdoor page do not.

## 8. Acceptance criteria (a change is acceptable only if all hold)

- [ ] No program/contract **name** is stored or displayed in the anonymous
      benchmark (Lane ①). Named contracts exist only in the consent-gated lane.
- [ ] No query — including by an admin — links a contract-attribute datapoint to
      a person, an account, or a benefits submission.
- [ ] No contract-shape cell below `k` is displayable; coarsening (never lowering
      k) is the only way a finer cell becomes visible.
- [ ] A single job posting is shown as an *open role*, never as a market
      statistic.
- [ ] Public rate data (CALC/USAspending) and crowdsourced data live in tables
      with **no correlatable key** to identity.
- [ ] The canonical-LCAT mapping stores no employer/person-identifying free text
      that could re-narrow a coarsened cell.

## 9. Open questions

- Canonical-LCAT ontology: bootstrap source of record (CALC vs. vehicle catalogs)
  and the human-curation workflow for proposed title→node mappings.
- k threshold specifically for contract-attribute cells (may need k > 5 given the
  higher re-identification stakes of contract granularity).
- How much contract-attribute refinement (customer sector, prime/sub) to expose
  B2C vs. reserve for paid/B2B.
- Whether CALC awarded *hourly* rates map cleanly to salaried total-comp (wrap
  rate, fringe, escalation) — normalization factor needed.
- Trend/time-series retention of expired postings without creating a
  longitudinal re-identification vector.
