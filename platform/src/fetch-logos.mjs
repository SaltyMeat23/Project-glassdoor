// Fetch company logos SERVER-SIDE and self-host the bytes in Neon, so the
// browser only ever requests logos from our own origin — never a third party
// (SECURITY.md §8.2). Source: unavatar.io (aggregates og:image/favicon by
// domain) with `fallback=false` so we store only real logos, never a generic
// placeholder; DuckDuckGo's icon proxy as a backup. No Claude API — HTTP only.
//
// Run: cd platform && node --env-file=../.env src/fetch-logos.mjs [--limit N] [--concurrency N]
// Resumable: only touches employers with a website and no logo yet.

import { q, close } from './lib/db-postgres.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};
const LIMIT = Number(flag('limit', 400));
const CONCURRENCY = Number(flag('concurrency', 6));
const MAX_BYTES = 120_000; // skip anything bigger than a small logo (avoids full og: images)
const MIN_BYTES = 120; // skip empty / 1px trackers

function domainOf(website) {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Fetch a logo for a domain. Returns { bytes, mime } or null. */
async function fetchLogo(domain) {
  const sources = [
    `https://unavatar.io/${domain}?fallback=false`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
  for (const url of sources) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(9000) });
      if (!r.ok) continue;
      const mime = (r.headers.get('content-type') || '').split(';')[0].trim();
      if (!/^image\//i.test(mime)) continue;
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length < MIN_BYTES || bytes.length > MAX_BYTES) continue;
      return { bytes, mime };
    } catch {
      /* try next source */
    }
  }
  return null;
}

async function runPool(items, worker, concurrency) {
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (idx < items.length) await worker(items[idx++]);
    })
  );
}

async function main() {
  const targets = await q(
    `SELECT id, display_name, website FROM employer e
      WHERE website IS NOT NULL AND logo_bytes IS NULL
      ORDER BY (EXISTS(SELECT 1 FROM job_posting j WHERE j.employer_id = e.id)
                OR EXISTS(SELECT 1 FROM plan_terms t WHERE t.employer_id = e.id)) DESC,
               display_name ASC
      LIMIT $1`,
    [LIMIT]
  );
  const remaining = (
    await q('SELECT COUNT(*)::int c FROM employer WHERE website IS NOT NULL AND logo_bytes IS NULL')
  )[0].c;
  console.log(`Fetching logos for ${targets.length} of ${remaining} employers (concurrency ${CONCURRENCY}).`);

  let got = 0,
    miss = 0,
    done = 0;
  await runPool(
    targets,
    async (e) => {
      const domain = domainOf(e.website);
      done++;
      if (!domain) {
        miss++;
        return;
      }
      const logo = await fetchLogo(domain).catch(() => null);
      if (!logo) {
        miss++;
      } else {
        await q('UPDATE employer SET logo_bytes = $1, logo_mime = $2 WHERE id = $3', [
          logo.bytes,
          logo.mime,
          e.id,
        ]);
        got++;
      }
      if (done % 25 === 0) console.log(`  … ${done}/${targets.length} (${got} logos)`);
    },
    CONCURRENCY
  );

  const total = (await q('SELECT COUNT(*)::int c FROM employer WHERE logo_bytes IS NOT NULL'))[0].c;
  console.log(`\nDone. +${got} logos, ${miss} without one. Employers with a self-hosted logo: ${total}.`);
  await close();
}

main().catch(async (e) => {
  console.error('✗', e.message);
  await close();
  process.exit(1);
});
