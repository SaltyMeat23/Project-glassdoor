// ATS detection by careers-page fingerprinting — the scalable path for the long
// tail (docs/JOBS.md). For each employer website we fetch the homepage + a few
// common careers URLs and look for the ATS the page embeds, extracting the
// board token/tenant automatically (vs. brittle name-guessing).

// Ordered fingerprints: first match wins. `token` builds our ats_source token
// (Workday needs "host::tenant::site"; the rest are a single board handle).
const FINGERPRINTS = [
  {
    type: 'greenhouse',
    re: /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9]+)/i,
    token: (m) => m[1],
  },
  { type: 'greenhouse', re: /greenhouse\.io\/embed\/job_board\?for=([a-z0-9]+)/i, token: (m) => m[1] },
  { type: 'lever', re: /jobs\.lever\.co\/([a-z0-9][a-z0-9-]+)/i, token: (m) => m[1] },
  { type: 'ashby', re: /jobs\.ashbyhq\.com\/([a-z0-9][a-z0-9-]+)/i, token: (m) => m[1] },
  { type: 'smartrecruiters', re: /careers\.smartrecruiters\.com\/([A-Za-z0-9]+)/i, token: (m) => m[1] },
  {
    type: 'workday',
    re: /([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_]+)/i,
    token: (m) => `${m[1]}.${m[2]}.myworkdayjobs.com::${m[1]}::${m[3]}`,
  },
  { type: 'icims', re: /([a-z0-9-]+)\.icims\.com/i, token: (m) => m[1] },
];

/** Find an ATS reference in a page's HTML. Returns {ats_type, board_token} or null. */
export function fingerprintAts(html) {
  for (const fp of FINGERPRINTS) {
    const m = html.match(fp.re);
    if (m) {
      const token = fp.token(m);
      // Ignore obvious non-board tokens (bare "www", ATS vendor's own pages).
      if (token && !/^(www|embed|job_board|careers|jobs)$/i.test(token)) {
        return { ats_type: fp.type, board_token: token };
      }
    }
  }
  return null;
}

async function fetchText(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ContractIQ/0.1; +https://contractiq.io)' },
    });
    if (!r.ok) return null;
    if (!/html|text/i.test(r.headers.get('content-type') || '')) return null;
    return (await r.text()).slice(0, 500_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Candidate URLs to probe for an employer's careers/ATS embed. */
export function candidateUrls(website) {
  let origin;
  try {
    origin = new URL(website).origin;
  } catch {
    return [];
  }
  return [origin, `${origin}/careers`, `${origin}/careers/`, `${origin}/jobs`, `${origin}/company/careers`];
}

/** Detect an ATS for one employer website. Returns {ats_type, board_token, via} or null. */
export async function detectFromWebsite(website) {
  for (const url of candidateUrls(website)) {
    const html = await fetchText(url);
    if (!html) continue;
    const hit = fingerprintAts(html);
    if (hit) return { ...hit, via: url };
  }
  return null;
}
