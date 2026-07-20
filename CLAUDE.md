# ContractIQ

Total-compensation intelligence for the U.S. cleared defense workforce. Converts a
cleared offer's pay + benefits into a market percentile and dollar-valued total
rewards, anonymously — so a candidate can tell if an offer is true to market
_before_ signing. Repo folder is still `Project-glassdoor` (legacy); the product is
ContractIQ (contractiq.io).

**Last updated:** 2026-07.

## Tech stack

- **Web app (`apps/web`):** Next.js 16 (App Router) + React 19 + Tailwind v4 +
  TypeScript. Fonts self-hosted via `next/font`. Deploy target: Vercel.
- **Data + engine (`platform/`):** Node ESM, zero-framework. Dev uses built-in
  `node:sqlite` (`benefits.db`); production uses **Neon Postgres**. Only runtime
  deps: `adm-zip`, `csv-parse` (Form 5500 ingest). Requires Node ≥ 22.5.
- **Legacy (`src/`, root `package.json`):** the discarded Glassdoor-clone school
  project. Not used; do not build on it.

## Quick commands

```bash
# web app (apps/web)
npm run dev           # Next dev server (use -p 3100; 3000 is taken locally)
npm run build         # production build
npm run type-check    # tsc --noEmit
npm run lint          # ESLint
npm run format        # Prettier write   (format:check to verify)

# data + engine (platform)
npm run serve         # local data API on 127.0.0.1:8787 (the web app proxies here in dev)
npm run seed          # Form 5500 download + ingest + report
npm run seed-comp     # synthetic dev comp datapoints (dev only)
npm run comp-check -- --role "Software Engineer" --clearance "TS/SCI" --metro "Reston VA" --yoe 7 --base 150000
npm run value -- <employer> --salary 130000 --family      # benefits valuation
npm run compare -- <employerA> <employerB>                # benefits A/B
```

Two-process local dev: `platform` `npm run serve` (8787) + `apps/web` `npm run dev -- -p 3100`.

## Key directories

```
apps/web/              # Next.js app (the product UI)
├── app/               # App Router: / (hero), /compare (A/B), api/* (proxy routes)
├── components/        # PercentileTrack, Tabs
└── lib/               # platform proxy, shared types
platform/
├── db/schema.sql            # SQLite (dev) — schema.postgres.sql for Neon (prod)
├── src/comp/                # comp benchmark engine (normalize, benchmark, intake)
├── src/valuation/           # benefits valuation engine
├── src/intake/              # anonymous benefits intake (confirm/correct)
├── src/lib/                 # db, normalize, efast, benefit-codes helpers
├── src/server.mjs           # dev data API (node:http, :8787)
└── data/                    # curated seeds (employers, web-extracted terms)
docs/                  # design specs (see below)
```

## Security principles

> **Anonymity here is structural, not a policy.** The sensitive linkages
> (person → submission, person → employer, person → salary) must **not exist** in
> the schema. See `docs/SECURITY.md` — it is the source of truth and takes
> precedence over convenience.

1. **Verify, then forget** — prove a fact, mint an unlinkable credential, discard the input.
2. **No PII collected** — no name, email, SSN, DOB, address, clearance number/badge.
   Clearance is stored as a **tier** only; location as **metro**, never a site/base.
3. **No `user_id` on submissions**; coarse (YYYY-MM) timestamps only; no client IPs stored.
4. **k-anonymity** — never surface a data cell below k (default 5); widen/coarsen, never lower k.
5. **Zero trust on client input** — validate/normalize server-side; never trust the browser.
6. **No third-party scripts/analytics/fonts at runtime** (§8.2). Disable Vercel/Next telemetry.

## Architecture (production)

```
Browser → Vercel (Next.js) → Next API routes → Neon Postgres (data + engine queries)
```

- The browser never touches the data layer directly — only Next server routes do.
- In **dev**, Next API routes proxy to the `platform` `node:http` server (SQLite).
- The comp benchmark + benefits valuation engines live in `platform/src`; the
  migration path SQLite → Postgres is behind `platform/src/lib/db.mjs`. See `docs/DEPLOY.md`.

## Environment variables

Web app (`apps/web/.env.local`, see `.env.local.example`):

- `DATABASE_URL` — Neon Postgres connection string (prod data layer). **Never** `NEXT_PUBLIC_`.
- `PLATFORM_API` — dev-only proxy target (default `http://127.0.0.1:8787`).

## Documentation (`docs/`)

| Doc | Purpose |
| --- | --- |
| `STRATEGY.md`   | product strategy, data tiers, roadmap |
| `SECURITY.md`   | the anonymity architecture (hard constraints) |
| `INTAKE.md`     | anonymous confirm/correct submission design |
| `MARKETPLACE.md`| recruiter/candidate marketplace ("two products, one wall") |
| `BUSINESS.md`   | GTM / ClearanceJobs-competitor thesis |
| `DEPLOY.md`     | Vercel + Neon deploy plan |

## Agent guidelines

1. **`docs/SECURITY.md` is non-negotiable** — any auth/ingest/storage change must satisfy it.
2. Normalize + validate all inputs **server-side**; keep clearance as tier, location as metro.
3. Never add a `user_id`/PII column to a submission or comp table; keep timestamps coarse.
4. Keep the engine logic in `platform/src`; write portable SQL (SQLite dev ↔ Postgres prod).
5. Run `type-check`, `lint`, and `format:check` in `apps/web` before committing UI changes.
6. Commit in focused, isolated commits; the design direction is clean/data-forward, not gimmicky.
