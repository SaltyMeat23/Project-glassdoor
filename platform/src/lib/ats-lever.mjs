// Lever public postings adapter. The list endpoint returns the full JD (no
// detail-fetch needed): clearance + salary come straight from it. Structured
// fields + source link only, never the raw JD prose (docs/JOBS.md §3).
import { metroBucket, roleFamily } from '../comp/normalize-comp.mjs';
import { clearanceSignal, extractSalaryBand } from './ats-greenhouse.mjs';

/** GET all postings for a Lever board. Returns [] on empty, null on failure. */
export async function fetchLeverCleared(token) {
  try {
    const r = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const jobs = await r.json();
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return null;
  }
}

/** Normalize one Lever posting → our job_posting shape, or null if not cleared. */
export function normalizeLeverJob(job) {
  const title = String(job.text || '').trim();
  if (!title) return null;
  const body = [job.descriptionPlain, job.descriptionBodyPlain, job.additionalPlain]
    .filter(Boolean)
    .join(' ');
  const sig = clearanceSignal(title, body);
  if (!sig) return null; // cleared-only
  const loc = job.categories?.location || '';
  const band = extractSalaryBand(body);
  return {
    req_id: String(job.id),
    title,
    role_family: roleFamily(title),
    lcat_raw: job.categories?.team || null,
    clearance_tier: sig.tier,
    metro: metroBucket(loc),
    location_raw: loc || null,
    remote: /remote/i.test(job.workplaceType || '') || /remote/i.test(loc),
    salary_min: band?.min ?? null,
    salary_max: band?.max ?? null,
    source_url: job.hostedUrl || job.applyUrl || null,
    posted_period:
      typeof job.createdAt === 'number' ? new Date(job.createdAt).toISOString().slice(0, 7) : null,
  };
}
