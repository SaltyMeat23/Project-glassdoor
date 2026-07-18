# Signup & Intake Design

> How a user tells us which companies they've worked at and what they know about
> the benefits — **without** creating the person→employer→submission linkage that
> `docs/SECURITY.md` forbids. The affiliation is *collected* to route and verify;
> it is never *stored against the account*.

**Status:** Design spec. Companion to `docs/STRATEGY.md` and `docs/SECURITY.md`.
Any auth/intake/storage code MUST satisfy this. **Last updated:** 2026-07.

---

## 0. The one rule everything bends around

`SECURITY.md` §5.1: a stored submission carries **no `user_id`** and the
person→submission link **must not exist in the schema**. §5.2: no server-side
"my submissions" list if it would require storing that link. §3: verify
employment, then **forget** the identifying input.

So the design goal is a paradox we resolve deliberately:

> **Collect the company affiliation. Never persist it against the identity.**

The company a user picks is a *session-scoped routing/verification input*, not a
durable profile attribute. What survives the request is anonymous,
employer-tagged benefit data plus (optionally) an unlinkable proof-of-employment
token — nothing that says "this account works at X."

## 1. Why this matters for THIS audience

Cleared professionals' **employment history is itself sensitive**. A stored
"user 4821 → Lockheed → Northrop" trail is exactly what a targeted adversary
(SECURITY §1-C) or a subpoena (§1-D) would want. We must be structurally unable
to produce it. "We don't show it in the UI" is not enough; it must **not be in
the database**.

## 2. The flow

### 2.1 Signup / auth (SECURITY §4)
- **Passkey / WebAuthn only.** Server stores a public key. No password, no email,
  no shared secret.
- **System-generated pseudonymous handle.** Never user-chosen (§4.2).
- **Recovery via one-time codes** shown once at signup; email recovery is
  prohibited (§4.3). The lost-codes = lost-account trade-off is disclosed here.

### 2.2 "Which companies have you worked at?" (routing input, NOT stored)
- User selects one or more employers from the seed list (typeahead).
- This selection drives **which benefit-intake forms to show** and **which
  work-email domains we can offer to verify**.
- It is held in **session/client state only**. It is **never** written to a
  durable `user.employers` column. (Such a column *is* the forbidden edge.)
- Past vs. current is not distinguished in storage — both simply produce
  employer-tagged submissions.

### 2.3 Optional employment verification (raises trust tier) (SECURITY §3)
- If the user wants their contribution marked higher-trust, run **verify-and-
  forget**: send a one-time code to a work email (`@lmco.com`), confirm it, then
  **discard the address**.
- Preferred: mint a **blind / Privacy-Pass-style token** at verification
  attesting `"verified employee of <domain>, plan-year window <Y>"`. The client
  unblinds it; at submission the server checks the signature but **cannot
  correlate it to the verification event** (§3.3). This yields "verified but
  mathematically unlinkable."
- Skipping verification is allowed; the submission is just tagged
  `verification_tier = "unverified"`.

### 2.4 Intake = **confirm / correct**, not fill-from-blank
This is where scraping pays off (STRATEGY §4). For the selected employer we
**pre-fill** what we already hold from Form 5500 (plan exists + scale) and web
extraction (`plan_terms` at `inferred`/`reported` confidence), and ask the user
to validate:

```
Lockheed Martin — 401(k)  (from Lockheed's 2020 benefits PDF)
  Match: up to 4% of salary  + automatic 6% company contribution
  → Is this right for your plan year?   [ Confirm ]  [ Correct → ]  [ Don't know ]
```

- **Confirm** upgrades that term's confidence toward `verified` and records a
  fresh plan-year datapoint.
- **Correct** captures the user's value (with the old one kept for audit of the
  source, not the user).
- **Don't know** is a first-class answer — we never force a guess.

Only fields we *couldn't* pre-fill become open questions, and even those are
scoped to that employer's plan types. This is how scraping minimizes the ask.

## 3. What gets stored (and what never does)

**Written on submit** — an anonymous row set:

- `submission`: `employer_id`, optional `benefit_plan_id`, `plan_year`,
  `verification_tier` (`doc_verified` | `email_domain` | `unverified`),
  `submitted_period` (coarse, e.g. `2026-07`). **No `user_id`. No precise
  timestamp** (SECURITY §5.1, §5.3).
- `plan_terms`: the confirmed/corrected values, `source='crowdsourced'`,
  `confidence` per §4 below, linked to the employer (and plan when applicable).

**Never written** (SECURITY §2): real name, email, SSN, DOB, address, phone,
clearance/badge/program identifiers, client IP alongside submissions (§8.1),
or any `account_id`/`user_id` on the submission.

## 4. Confidence lifecycle

```
inferred  (web, third-party)      ─┐
reported  (web, employer PDF/SEC) ─┼─►  crowdsourced confirm  ─►  verified
                                   │    crowdsourced correct   ─►  reported (new value, new plan-year)
```

A term surfaced to users always shows its **provenance and confidence**
("employer PDF, 2024" vs. "member-confirmed, 2026"). Trust is earned by showing
the source, never asserted.

## 5. "My submissions" — the deliberate trade-off (RESOLVED: option B)

§5.2 means there is **no server-side list of a user's own submissions** — we
can't show it because we don't know which rows are theirs. Two options were
considered:

- **(A) Pure** — accept resubmission over ownership; the server remembers
  nothing per-user. Simplest, strongest privacy, worst convenience.
- **(B) Client-held local record (CHOSEN)** — the user's **own device** keeps a
  local record (e.g. encrypted local storage / the passkey-bound origin) of what
  they submitted, so *they* can review/update it, while the **server still stores
  nothing linkable**. The record never leaves the device and is never keyed to a
  server-side identity.

**Why B:** preserves the SECURITY guarantee intact (server-side is identical to
A) while restoring most of the convenience. The cost is that the local record is
device-bound — clearing the browser / switching devices loses the *convenience
history*, never the submitted *data*. This limitation is disclosed to the user,
same as the recovery-code trade-off.

Implementation notes for B:
- Store only: `{employer_id, plan_year, term_keys submitted, coarse date}` — the
  minimum to render "you've contributed to Lockheed 401(k), Jul 2026." No
  server round-trip identifies it.
- On revisit, the client can pre-select those employers to offer "update your
  earlier answers" — which simply produces a **new anonymous submission**, not an
  edit of an owned row.
- Never sync this record to the server. If we ever add multi-device sync, it must
  be end-to-end encrypted with a client-only key, and even then it must not be
  correlatable server-side to submissions.

## 6. Anti-abuse without re-introducing linkage (SECURITY §8.3)

- Rate-limiting / dedup uses the **unlinkable token** (§2.3) or a
  `HMAC(normalized_email, pepper)` kept in a **separate datastore** with no join
  key to submissions (§3.2), never a `user_id` on the submission.
- Keep auth events and submission events in **separate systems** so no timing
  join is possible (§8.3).

## 7. Acceptance criteria (a change is acceptable only if all hold)

- [ ] No durable field anywhere maps an account/identity to an employer.
- [ ] A full DB dump cannot link any submission to a person or account.
- [ ] Company selection exists only in session/client state, never a stored
      `user.employers`.
- [ ] Employment verification discards the raw email; only an unlinkable token
      (and/or isolated dedup HMAC) persists.
- [ ] Submissions carry no `user_id` and only a coarse period.
- [ ] The client-held record (option B) never leaves the device and is never
      keyed to a server identity.
- [ ] Every surfaced term shows its source + confidence.

## 8. Open questions

- Blind-token scheme (RSA blind sig vs. VOPRF/Privacy Pass) and rotation — shared
  with SECURITY §10.
- Exact confidence-promotion rule: how many independent confirmations move a term
  to `verified`, and how corrections are reconciled (k-of-n agreement?).
- Whether "Don't know" answers should still record a coarse signal (plan exists
  but terms unknown) or nothing.
- Client-record format and its disclosure copy at signup.
