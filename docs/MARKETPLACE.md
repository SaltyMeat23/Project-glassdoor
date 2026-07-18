# Candidate Marketplace & B2B Design

> How recruiters find cleared candidates **without** compromising the structural
> anonymity of the benefits data. The design principle is **two products, two
> hats, one wall**: the same human may contribute benefits data anonymously AND
> list themselves as a discoverable candidate, but the system is
> **architecturally unable to know those are the same person.**

**Status:** Design spec. Companion to `STRATEGY.md`, `SECURITY.md`, `INTAKE.md`.
Any marketplace code MUST satisfy §1's wall. **Last updated:** 2026-07.

---

## 0. The tension, stated precisely

A recruiter marketplace (think **ClearanceJobs**) needs *identifiable,
contactable people*. The benefits dataset needs the *person→submission link to
not exist* (`SECURITY.md` §5). These are opposite requirements; no single
identity can satisfy both.

Resolution: they are **two separate products** for possibly-overlapping humans.

- **Contributor hat** — anonymous benefits data (built; see `INTAKE.md`).
- **Candidate hat** — opt-in, identifiable-by-choice, "come find me."

## 1. The wall (non-negotiable)

> The candidate marketplace and the benefits-submission store are **separate
> datastores with no shared key, no foreign key, and no correlatable metadata**
> (timestamps, IPs, device ids). Same person → two accounts → **zero join**.

Consequences that make it safe:

- A recruiter browsing candidates learns **nothing** about who submitted benefits.
- A breach of the candidate DB does not expose benefit contributors, or vice-versa.
- The **operator** cannot join them (`SECURITY.md` §1-B, §8.3).

**Requirement 1.1 — No cross-product identifier.** A candidate account and a
contributor account share no id, email, handle, or derived key. Ideally distinct
auth origins so even a passkey cannot correlate them.

**Requirement 1.2 — No correlatable metadata.** Do not co-log or co-store
timestamps/IPs that could align a candidate action with a benefits submission
(`SECURITY.md` §8.1, §8.3).

**Requirement 1.3 — Separate consent.** Marketplace signup is a distinct,
explicit opt-in, worded so users understand it is *identifiable by choice*,
unlike anonymous benefits contribution.

## 2. What we do and don't promise

- ✅ Your **anonymous benefits submissions can never be tied to you** — even if
  you also list yourself as a candidate.
- ❌ We do **not** promise you are invisible everywhere. Opting into the
  marketplace means you chose to be findable *there*. Disclose this plainly.

## 3. Candidate identity model

**Requirement 3.1 — Pseudonymous talent card.** A card carries coarse attributes
only: clearance **tier** (e.g. "TS/SCI" — never program/codeword/badge), skill
tags, **metro** (never site/base), years of experience, target-comp **band**,
availability. **No** real name, current employer, or contact info on the card.

**Requirement 3.2 — k-anonymity on cards (`SECURITY.md` §7).** A card too unique
to be safe (e.g. "TS/SCI + full-scope poly + one rare skill + small metro" that
matches a handful of people) is **suppressed or coarsened** before it is
searchable. Same statistical-disclosure discipline as the benefits side.

**Requirement 3.3 — Candidate-side block list.** "Don't show me to these
employers" (including their current one) is stored **candidate-side**, never as a
server-side "works-at" fact. Enforced by filtering the recruiter's result set.

**Requirement 3.4 — Go dark instantly.** A candidate can unlist at any time; the
card and any pending intro requests disappear.

## 4. Discovery: **consent-gated reveal** (chosen model)

Recruiters never harvest a directory of people. The flow:

1. **Search anonymous cards.** A verified recruiter searches k-anonymized talent
   cards. They see attributes only — no identity, no contact.
2. **Request an intro.** The recruiter sends an intro request (with the role,
   comp, and a short note) to a card. This does **not** reveal the candidate.
3. **Candidate decides.** The candidate sees the request and approves or denies.
   Nothing is revealed on deny.
4. **Reveal on approval, via relay.** On approval, contact opens through a
   **platform relay inbox** — the recruiter still does **not** get the
   candidate's personal email until/unless the candidate shares it. Identity
   reveal is staged and candidate-controlled.

This maximizes candidate control (every reveal is an explicit yes) while giving
recruiters real inbound liquidity.

## 5. Recruiter / employer side

**Requirement 5.1 — Verified recruiters only.** Recruiters/orgs are
identity-verified (verified company, seat-based). This is the *opposite* of the
candidate side — recruiters are accountable and non-anonymous, which deters abuse
and fake-recruiter harvesting.

**Requirement 5.2 — No bulk export / rate-limited search.** Cards are viewable
for matching, not exportable. Search and intro-request volume are rate-limited
per seat to prevent building a shadow database of cleared people.

**Requirement 5.3 — Recruiters never see benefits-contributor data as people.**
They may see *aggregate* benefits benchmarks (the other B2B product, §7), never
anything tied to an individual.

## 6. Contact relay

**Requirement 6.1 — Relay, not personal channels.** All recruiter↔candidate
contact flows through a platform relay until the candidate chooses to share a
direct channel. The candidate can cut the relay at any time.

## 7. The two B2B products (they reinforce, never share data)

| Product | Data it sells | Privacy posture |
| --- | --- | --- |
| **Benefits benchmarking** (STRATEGY §6.2) | anonymous **aggregate** total-rewards data | fully privacy-clean; no candidate identity involved |
| **Candidate marketplace** (this doc) | an **opt-in, separate** talent pool | identifiable by candidate choice; walled off from benefits data |

An employer buying benchmarking is a warm lead for recruiting, and vice-versa —
commercial synergy with **no shared row of data**.

## 8. Data model sketch (separate store from benefits)

Distinct database/schema, no FK to any benefits table:

- **talent_card** — pseudonymous: clearance_tier, skill_tags, metro, yoe,
  comp_band, availability, k_anon_ok flag. No name/employer/contact.
- **candidate_account** — auth only (passkey); holds the private block-list and
  the (candidate-controlled) real contact, released only on approval.
- **recruiter** / **org** — verified, seat-based, non-anonymous.
- **intro_request** — recruiter_id, talent_card_id, role/comp/note, status
  (pending/approved/denied). Created by recruiter; resolved by candidate.
- **relay_thread** — brokered messages post-approval; no personal channel until
  candidate shares one.

## 9. Anti-abuse

- Verified recruiters + seat model + rate limits + no bulk export (§5).
- k-anonymity suppression so a card can't be reverse-identified (§3.2).
- Candidate block-list + go-dark (§3.3, §3.4).
- Relay contact so a "reveal" is a message channel, not an email dump (§6).

## 10. Acceptance criteria (a change is acceptable only if all hold)

- [ ] No query — by anyone, including an admin — can link a talent card / candidate
      account to any benefits submission or contributor account.
- [ ] Candidate and contributor stores share no identifier and no correlatable
      timestamp/IP.
- [ ] Recruiters see candidate identity/contact **only** after that candidate
      approves an intro request.
- [ ] No searchable card falls below the k-anonymity threshold.
- [ ] Marketplace opt-in is a separate, explicit consent from benefits contribution.
- [ ] Recruiters cannot bulk-export cards; search is rate-limited.

## 11. Open questions

- k threshold and coarsening buckets for talent cards (align with `SECURITY.md`
  §7 choices).
- Recruiter verification bar (company domain? paid seat + manual review?).
- Whether candidates may see *which* employer is requesting before approving
  (helps them, but is a small identity leak toward the recruiter's targeting).
- Relay retention/erasure policy.
- Pricing: seat-based recruiting vs. benchmarking subscription; bundle or separate.
