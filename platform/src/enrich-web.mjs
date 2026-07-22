// Web-enrich employer profiles with a lower-tier model (Claude Haiku 4.5 + the
// web_search server tool). For each company that has no description yet, Haiku
// searches the web and returns {website, industry, about}; we COALESCE it into
// Neon so nothing already curated (the 39 seeds, the ~10 hand-done) is clobbered.
//
// Scope is a PRIORITIZED SUBSET, not the whole 1,700-row tail: rows are ordered
// data-employers-first, then partially-filled, then A→Z, and capped by --limit.
// It's resumable (only touches `about IS NULL`) — re-run with a bigger --limit
// to widen coverage. Companies Haiku can't confidently identify are left as
// name-only for a later on-demand pass.
//
// Cost: Haiku is $1/$5 per Mtok; web search ~$10/1k searches. ~250 companies ×
// a few searches ≈ a few dollars. Grounded in real search results (not model
// memory) to avoid hallucinated descriptions.
//
// Run: cd platform && node --env-file=../.env src/enrich-web.mjs [--limit N] [--concurrency N] [--dry-run]
//   Requires ANTHROPIC_API_KEY in ../.env (git-ignored), alongside DATABASE_URL.

import Anthropic from '@anthropic-ai/sdk';
import { q, close } from './lib/db-postgres.mjs';

// ---- flags -----------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
};
const LIMIT = Number(flag('limit', 250));
const CONCURRENCY = Number(flag('concurrency', 4));
const DRY_RUN = argv.includes('--dry-run');
const MODEL = 'claude-haiku-4-5';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    '✗ ANTHROPIC_API_KEY is not set. Add it to platform/.env (or ../.env) and run with --env-file=../.env'
  );
  process.exit(1);
}
const anthropic = new Anthropic();

// ---- the research call -----------------------------------------------------
const clean = (v) => {
  const s = String(v ?? '').trim();
  return s && s.length > 1 && s.toLowerCase() !== 'null' ? s : null;
};

// Website URLs are rendered as links, so only accept http(s) — reject
// javascript:/data:/other schemes at the source (defense in depth with the
// render-side guard in app/companies/[slug]/page.tsx).
const cleanUrl = (v) => {
  const s = clean(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

function extractJson(text) {
  // Grab the last {...} block (Haiku sometimes narrates before the JSON).
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function research(name) {
  const prompt =
    `You are researching a U.S. company for a cleared-defense employer directory. ` +
    `Company name: "${name}".\n\n` +
    `Use web search to find its official company website, its primary industry, and a ` +
    `one-to-two sentence factual description of what it does. Focus on the defense / ` +
    `government-contracting entity if the name is ambiguous.\n\n` +
    `Rules:\n` +
    `- If you cannot confidently identify a real, specific company by this name (too ` +
    `generic, no clear results, or clearly a different unrelated business), set found=false.\n` +
    `- Never guess or fabricate. Ground every field in the search results.\n` +
    `- "about" must be factual and neutral (no marketing language), max ~280 chars.\n` +
    `- "website" must be the official homepage URL (https://…), or null.\n\n` +
    `Respond with ONLY a JSON object as the final thing you output:\n` +
    `{"found": boolean, "website": string|null, "industry": string|null, "about": string|null}`;

  const messages = [{ role: 'user', content: prompt }];
  let resp;
  // web_search runs a server-side loop; it can return pause_turn if it needs to
  // continue. Re-send the assistant turn to resume (max a few hops).
  for (let hop = 0; hop < 4; hop++) {
    resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // Haiku 4.5 uses the basic web-search variant (no _20260209 dynamic filtering).
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
      messages,
    });
    if (resp.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: resp.content });
  }

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const parsed = extractJson(text);
  if (!parsed || !parsed.found) return null;
  return {
    website: cleanUrl(parsed.website),
    industry: clean(parsed.industry),
    about: clean(parsed.about),
  };
}

// ---- concurrency runner ----------------------------------------------------
async function runPool(items, worker, concurrency) {
  let idx = 0;
  const results = new Array(items.length);
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

// ---- main ------------------------------------------------------------------
async function main() {
  // Prioritized subset: employers we have benefits/comp data for come first
  // (the ones people actually work at), then partially-filled rows, then A→Z.
  const targets = await q(
    `SELECT id, slug, display_name
       FROM employer e
      WHERE about IS NULL
      ORDER BY
        (EXISTS(SELECT 1 FROM plan_terms t WHERE t.employer_id = e.id)
         OR EXISTS(SELECT 1 FROM comp_datapoint c WHERE c.employer_id = e.id)) DESC,
        (website IS NOT NULL OR logo_url IS NOT NULL) DESC,
        display_name ASC
      LIMIT $1`,
    [LIMIT]
  );

  const remaining = (await q('SELECT COUNT(*)::int c FROM employer WHERE about IS NULL'))[0].c;
  console.log(
    `Enriching ${targets.length} of ${remaining} un-described employers ` +
      `(model=${MODEL}, concurrency=${CONCURRENCY}${DRY_RUN ? ', DRY RUN' : ''}).`
  );

  let filled = 0,
    skipped = 0,
    errored = 0,
    done = 0;

  await runPool(
    targets,
    async (e) => {
      try {
        const info = await research(e.display_name);
        done++;
        if (!info || (!info.about && !info.website && !info.industry)) {
          skipped++;
          if (done % 10 === 0) console.log(`  … ${done}/${targets.length}`);
          return;
        }
        if (!DRY_RUN) {
          // COALESCE: fill only empty fields — never clobber curated data.
          // provenance records the ROW's origin (seed vs clearancejobs_2024);
          // enrichment doesn't change that, so we leave it untouched.
          await q(
            `UPDATE employer SET
               about    = COALESCE(about, $1),
               website  = COALESCE(website, $2),
               industry = COALESCE(industry, $3)
             WHERE id = $4`,
            [info.about, info.website, info.industry, e.id]
          );
        }
        filled++;
        console.log(
          `  ✓ ${e.display_name}${info.industry ? ` — ${info.industry}` : ''}` +
            `${info.website ? ` — ${info.website}` : ''}`
        );
      } catch (err) {
        errored++;
        console.warn(`  ✗ ${e.display_name}: ${err.message}`);
      }
    },
    CONCURRENCY
  );

  console.log(
    `\nDone. Filled ${filled}, skipped ${skipped} (not confidently identified), ${errored} errors.`
  );
  if (!DRY_RUN) {
    const withAbout = (await q('SELECT COUNT(*)::int c FROM employer WHERE about IS NOT NULL'))[0].c;
    console.log(`Employers with a description now: ${withAbout}.`);
  }
  await close();
}

main().catch(async (e) => {
  console.error('✗', e.message);
  await close();
  process.exit(1);
});
