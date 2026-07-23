// Ashby public job-board adapter. The list endpoint returns the full JD plus a
// structured compensation field (with includeCompensation=true) — no
// detail-fetch needed. Structured fields + source link only (docs/JOBS.md §3).
import { metroBucket, roleFamily } from '../comp/normalize-comp.mjs';
import { clearanceSignal, extractSalaryBand } from './ats-greenhouse.mjs';

/** GET all jobs for an Ashby org. Returns [] on empty, null on failure. */
export async function fetchAshbyCleared(org) {
  try {
    const r = await fetch(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.jobs) ? j.jobs : [];
  } catch {
    return null;
  }
}

/** Normalize one Ashby job → our job_posting shape, or null if not cleared. */
export function normalizeAshbyJob(job) {
  const title = String(job.title || '').trim();
  if (!title) return null;
  const body = job.descriptionPlain || '';
  const sig = clearanceSignal(title, body);
  if (!sig) return null; // cleared-only
  const loc = job.location || '';
  // Prefer Ashby's structured compensation summary; fall back to the JD text.
  const summary =
    job.compensation?.scrapeableCompensationSalarySummary ||
    job.compensation?.compensationTierSummary ||
    '';
  const band = extractSalaryBand(summary) || extractSalaryBand(body);
  return {
    req_id: String(job.id),
    title,
    role_family: roleFamily(title),
    lcat_raw: job.department || job.team || null,
    clearance_tier: sig.tier,
    metro: metroBucket(loc),
    location_raw: loc || null,
    remote: !!job.isRemote || /remote/i.test(loc),
    salary_min: band?.min ?? null,
    salary_max: band?.max ?? null,
    source_url: job.jobUrl || job.applyUrl || null,
    posted_period: typeof job.publishedAt === 'string' ? job.publishedAt.slice(0, 7) : null,
  };
}
