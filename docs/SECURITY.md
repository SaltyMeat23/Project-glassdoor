# Privacy & Security Architecture

> Design requirements for a platform serving **cleared defense-industry
> professionals**. Anonymity here is not a feature or a policy — it is
> **structural**. The system must be architected so the sensitive linkages
> (person → submission, person → employer, person → salary) **do not exist**,
> such that even a total compromise of our own infrastructure reveals
> employer-level benefit data and nothing about who submitted it.

**Status:** Design spec. Auth, ingest, and storage code MUST satisfy these
requirements. Treat any deviation as a defect.
**Companion to:** `docs/STRATEGY.md`.
**Last updated:** 2026-07.

---

## 0. Prime directive

> **Verify, then forget.** Prove the fact you need at a single instant, mint an
> unlinkable credential from it, and discard the identifying input.

Everything below follows from this. The most secure PII is PII that was never
stored. Before adding any field, ask: *"What breaks if this leaks?"* If the answer
is "someone's cleared identity," it must not be collected.

## 1. Threat model (design against, in priority order)

| # | Adversary | Requirement |
| --- | --- | --- |
| A | Opportunistic breach of our infra | A full DB dump reveals no PII and no person→submission link |
| B | **The operator / a malicious insider (us)** | We MUST be unable to deanonymize even with full production access |
| C | Targeted intelligence-service adversary hunting cleared individuals | No quasi-identifier combination re-identifies a submitter |
| D | Legal process / subpoena | We cannot produce what we never stored |

If a design decision fails against **(B)**, it is not acceptable. "We promise not
to look" is not a control.

## 2. Data we MUST NEVER collect

Not "encrypted" — **not collected**:

- Real name, legal name, or any government name
- SSN, date of birth, home address
- Phone number
- Personal email used as an identity anchor
- Any clearance number, badge number, or program code name

## 3. Employment verification — verified but unlinkable

**Goal:** confirm a work-email *domain* (e.g. `@lmco.com`) to establish data
trust, without ever linking that email to a submission.

**Requirement 3.1 — Verify-and-forget.** Send a one-time code to the work email,
confirm it, then **discard the address**. Persist at most
`HMAC(normalized_email, server_pepper)`, and only for duplicate-account
prevention. The raw address MUST NOT be written to any durable store or log.

**Requirement 3.2 — Storage isolation.** The dedup HMAC (if used) lives in a
**separate datastore** from submissions, with no foreign key, join key, or
timestamp that can correlate the two.

**Requirement 3.3 — Preferred: blind/unlinkable tokens.** Use a blind-signature /
Privacy-Pass-style scheme:
1. At verification, the server signs a **blinded** token attesting
   "verified employee of domain X, plan-year window Y."
2. The client unblinds the token locally.
3. At submission time the client presents the token; the server verifies the
   signature but **cannot correlate it to the verification event**.

This yields "verified but mathematically unlinkable." When implemented, it
supersedes 3.1's HMAC for attribution purposes (the HMAC may remain solely for
rate/dedup control, subject to 3.2).

## 4. Authentication without PII

**Requirement 4.1 — Passkeys / WebAuthn as the primary method.** The server stores
only a public key. No password, no shared secret, no email.

**Requirement 4.2 — Pseudonymous handles are system-generated**, never
user-chosen. Reused usernames are a re-identification vector.

**Requirement 4.3 — Recovery via one-time codes only.** Email-based recovery is
prohibited (it reintroduces PII). The usability trade-off (lost codes = lost
account) is intentional and MUST be disclosed to users at signup.

## 5. Submissions are NOT owned by accounts

**Requirement 5.1 — No `user_id` (or equivalent back-reference) on a stored
submission.** A submission row carries only:

```
employer, benefit_terms, plan_year, verification_tier, submitted_period (coarse)
```

The account gates the **act** of submitting (anti-spam, dedup, employment proof);
it does not **own** the resulting data. The person→submission link MUST NOT exist
in the schema.

**Requirement 5.2 — No editable "my submissions" list** if providing one would
require storing the very link 5.1 forbids. Prefer resubmission over ownership.

**Requirement 5.3 — Coarse timestamps.** Store submission time at low resolution
(e.g. month/plan-year), never a precise timestamp that could be correlated with
login/verification events.

## 6. Uploaded documents — the highest-risk surface

Offer letters and SPD/SBC PDFs contain names, addresses, salary-tied-to-name, and
sometimes SSNs.

**Requirement 6.1 — Redact/parse at the edge.** Extract structured fields
client-side where feasible, otherwise in an **ephemeral server sandbox** that is
destroyed immediately after extraction.

**Requirement 6.2 — Never persist the raw document.** Not encrypted-at-rest, not
"temporarily." Only the extracted structured fields (match %, HSA $, PTO accrual,
plan year) survive ingest. Everything else is discarded before the request
completes.

## 7. Re-identification defense (statistical disclosure control)

Even fully anonymized, `employer + role + location + salary` is a
**quasi-identifier** — critical for small cleared programs where a handful of
people could be uniquely identified.

**Requirement 7.1 — k-anonymity / cell suppression.** Do not surface a data point
until **≥ k submissions** (initial default `k = 5`, tunable) exist for that
employer/role/location cell.

**Requirement 7.2 — Coarsen quasi-identifiers on display.** Bucket salaries,
generalize location to metro (never site), broaden roles to families.

**Requirement 7.3 — Consider noise on aggregates.** Apply differential-privacy-
style noise to published aggregate statistics where it does not destroy utility.

## 8. Infrastructure & operational hygiene

**Requirement 8.1 — Do not log client IPs alongside submissions.** Terminate IPs
at an edge/proxy that never forwards them to the application. IP + timestamp is a
linkage vector.

**Requirement 8.2 — No third-party trackers or analytics.** No Google Analytics,
no ad SDKs, no external tag managers. Self-host any needed analytics. Third-party
scripts silently exfiltrate the correlations this document exists to prevent.

**Requirement 8.3 — Break timing correlation.** Keep authentication events and
submission events in separate systems; never co-log them in a way that permits a
join.

**Requirement 8.4 — Baseline controls.** TLS in transit; encryption at rest;
field-level encryption for any sensitive field; minimal logging with short
retention and PII scrubbing; least-privilege database access; managed secrets.

## 9. What "done" looks like (acceptance test)

A design or code change is acceptable only if all of the following hold:

- [ ] A full production database dump contains **no** real names, contact info,
      SSNs, or clearance identifiers.
- [ ] No query — by anyone, including an admin with full access — can map a stored
      submission back to an account or a person.
- [ ] Raw uploaded documents do **not** exist in any durable store after ingest.
- [ ] No data cell below `k` submissions is displayable.
- [ ] No client IP or precise submission timestamp is persisted with submission
      data.
- [ ] No third-party script runs in the client.

## 10. Open questions

- Blind-token scheme selection (e.g. RSA blind signatures vs. VOPRF/Privacy Pass)
  and key-rotation policy.
- Final `k` threshold per data category, and coarsening buckets per quasi-
  identifier.
- Abuse/rate-limiting design that does not reintroduce a person→submission link.
- Whether to offer any account-linked convenience features at all, given §5.
