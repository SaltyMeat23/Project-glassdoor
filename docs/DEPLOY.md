# Deploy — Vercel + Neon

> How ContractIQ goes from two localhost processes to a live, scaling URL.

## Architecture (prod)

```
Browser ──► Vercel (Next.js: apps/web)
               └─ Next API routes (app/api/*)  ──►  Neon Postgres (data + engine queries)
```

- **No standalone node:http server in prod.** The Next API route handlers run the
  comp/valuation engine directly against Neon (via the serverless Postgres driver).
  The local `platform` `npm run serve` + SQLite stays for **local dev and the data
  pipelines** (Form 5500 ingest, web-extraction merge, comp seed).
- **One database, Postgres, for the app.** `benefits.db` (SQLite) is dev-only.
- SECURITY §8.2 preserved: no third-party analytics; Vercel/Next telemetry disabled;
  fonts self-hosted via `next/font`.

## Division of labor

**Claude does (code):** Postgres schema (`platform/db/schema.postgres.sql`), the
async data layer (SQLite for dev ↔ Postgres for prod behind one interface), the
seed-migration script, Next API wiring, and Vercel config. Verified on SQLite so the
logic is proven before it hits Neon.

**You do (accounts — I can't create accounts or handle credentials):**
1. **Neon** — create a project at neon.tech (US region). Copy the connection string
   (`postgresql://…`). Optionally create a `dev` branch for local testing.
2. **Vercel** — create a project, connect this GitHub repo, set the **Root Directory**
   to `apps/web`.
3. **Env var** — in Vercel (and a local `apps/web/.env.local`, git-ignored), set
   `DATABASE_URL` to the Neon connection string. Never paste it into chat.

## Migration steps (once Neon exists)

1. `DATABASE_URL=… node platform/src/migrate-postgres.mjs` — applies
   `schema.postgres.sql` and loads the seed (39 employers + benefit terms, and any
   comp datapoints) into Neon.
2. `apps/web` builds and deploys on Vercel; API routes read/write Neon.
3. Verify: open the Vercel URL → run a comp check and an A/B compare.

## Notes / open items

- **Comp data is crowdsourced-only** — after deploy it starts thin and fills via the
  give-to-get loop; k-anonymity keeps sub-k cells hidden. Real cleared users are the
  only source (by design), so shipping is what starts the data flywheel.
- Rate-limiting / abuse controls and the real passkey + blind-token verification
  (currently stubbed) should land before a public launch (SECURITY §3, §8).
- Data residency: keep Neon in a US region for the cleared audience.
