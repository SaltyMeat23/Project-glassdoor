// Workday public job-board adapter. Unlocks the big primes (Leidos, Northrop,
// CACI, KBR, …) that Greenhouse doesn't reach. Each employer is a Workday tenant
// with its own host + site; board_token encodes "host::tenant::site".
//
// The CXS list endpoint (POST .../jobs) returns title/location/req-id but NO body
// or salary, so we narrow to cleared roles server-side via `searchText:"clearance"`
// and take the tier from the title where present. (Body-precise classification +
// salary need per-job detail fetches — a follow-up; docs/JOBS.md §3.)
import { metroBucket, roleFamily } from '../comp/normalize-comp.mjs';
import { clearanceSignal, tierFromText } from './ats-greenhouse.mjs';

export function parseWorkday(token) {
  const [host, tenant, site] = String(token).split('::');
  return { host, tenant, site };
}

async function fetchPage({ host, tenant, site }, offset, searchText) {
  const r = await fetch(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }),
  });
  if (!r.ok) return null;
  return r.json(); // { total, jobPostings: [...] }
}

/** Fetch cleared postings for a Workday board (paginated). Returns
 *  { total, jobs, truncated, wd } or null on failure. */
export async function fetchWorkdayCleared(token, { maxPages = 60 } = {}) {
  const wd = parseWorkday(token);
  const first = await fetchPage(wd, 0, 'clearance');
  if (!first) return null;
  const total = first.total ?? 0;
  const jobs = [...(first.jobPostings || [])];
  const pages = Math.min(maxPages, Math.ceil(total / 20));
  for (let p = 1; p < pages; p++) {
    const j = await fetchPage(wd, p * 20, 'clearance');
    if (j?.jobPostings) jobs.push(...j.jobPostings);
  }
  return { total, jobs, truncated: total > jobs.length, wd };
}

/** Normalize one Workday list item → our job_posting shape.
 *  The `searchText:"clearance"` filter already establishes it's a cleared role,
 *  so we keep it even when the title omits an explicit tier (tier → null). */
export function normalizeWorkdayJob(job, wd) {
  const title = String(job.title || '').trim();
  if (!title) return null;
  const sig = clearanceSignal(title, '');
  const tier = sig?.tier ?? tierFromText(title);
  const loc = job.locationsText || '';
  return {
    req_id: job.bulletFields?.[0] || job.externalPath,
    title,
    role_family: roleFamily(title),
    lcat_raw: null,
    clearance_tier: tier,
    metro: metroBucket(loc),
    location_raw: loc || null,
    remote: /remote/i.test(loc) || /remote/i.test(title),
    salary_min: null, // Workday list has no salary; detail-fetch is a follow-up
    salary_max: null,
    source_url: `https://${wd.host}/${wd.site}${job.externalPath}`,
    posted_period: null, // postedOn is relative text ("Posted 30+ Days Ago")
  };
}
