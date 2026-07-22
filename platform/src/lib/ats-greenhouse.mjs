// Greenhouse public job-board adapter (no auth). Returns normalized, CLEARED-only
// postings — structured fields + source link only, never the raw JD prose
// (docs/JOBS.md §3). Reuses the comp normalizers so postings land in the same
// role/clearance/metro vocabulary as the benchmark.
import { metroBucket, roleFamily } from '../comp/normalize-comp.mjs';

const GH = 'https://boards-api.greenhouse.io/v1/boards';

// Extract a clearance tier from free text with WORD-BOUNDARIED tokens. (The comp
// `clearanceTier()` does substring matching — fine for a clearance field, but on
// job titles "\bsci\b" must not fire on "scientist"/"science", so we can't reuse it.)
export function tierFromText(s) {
  if (/\b(full[-\s]?scope|ci\s+poly|poly(?:graph)?|lifestyle\s+poly)\b/i.test(s)) return 'ts_sci_poly';
  if (/\bTS\/SCI\b|\bTS[-\s]SCI\b|\bSCI\b/i.test(s)) return 'ts_sci';
  if (/\btop\s*secret\b|\bTS\b/i.test(s)) return 'ts';
  if (/\bsecret\b/i.test(s)) return 'secret';
  if (/\bpublic\s+trust\b/i.test(s)) return 'none';
  return null;
}

/** Greenhouse `content` is HTML-entity-escaped (not URI-encoded). Strip to text. */
export function stripHtml(html) {
  return String(html || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Clearance in the TITLE is a reliable "this is a cleared role" signal.
const TITLE_CLEARANCE_RE =
  /\b(TS\/SCI|TS[-\s]?SCI|top\s*secret|\bTS\b|\bsecret\b|clearance\s+required|active\s+clearance|poly(?:graph)?|full[-\s]?scope)\b/i;

// In the BODY, require a *tier* tied to an active/required phrasing. These
// deliberately exclude "eligible/able to obtain a clearance" boilerplate, which
// describes a clearable (NOT cleared) role and otherwise floods the results.
// NOTE: regex is a pragmatic prototype classifier; production should use a Haiku
// pass for precision (docs/JOBS.md §3, CONTRACT-INTELLIGENCE.md §3).
const TIER = String.raw`TS\/SCI|top\s*secret|\bsecret\b|poly(?:graph)?|full[-\s]?scope`;
const BODY_PATTERNS = [
  new RegExp(String.raw`\b(?:active|current|existing|must\s+(?:have|hold|possess))\b[\s\S]{0,25}?\b(?:${TIER})\b`, 'gi'),
  new RegExp(String.raw`\b(?:${TIER})\b[\s\S]{0,25}?\bclearance\b[\s\S]{0,15}?\b(?:required|mandatory)\b`, 'gi'),
  new RegExp(String.raw`\brequires?\b[\s\S]{0,20}?\b(?:${TIER})\b`, 'gi'),
];
const OBTAINABLE_RE = /\b(obtain|eligible|ability|able|willing)\b/i;

/** Decide whether a role is cleared; return {tier} (tier may be null if the role
 *  requires a clearance but doesn't name a level), or null if not cleared. */
export function clearanceSignal(title, text) {
  if (TITLE_CLEARANCE_RE.test(title)) {
    return { tier: tierFromText(title) || tierFromText(text) || null };
  }
  for (const re of BODY_PATTERNS) {
    for (const m of text.matchAll(re)) {
      // Reject clearable-not-cleared: "obtain/eligible" just before or inside the match.
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      if (OBTAINABLE_RE.test(before) || /\bobtain\b/i.test(m[0])) continue;
      return { tier: tierFromText(m[0]) || null };
    }
  }
  return null;
}

/** Parse one "$NNN,NNN" / "$NNNk" figure. Returns annual dollars, or null if the
 *  raw token is a bare small number (ambiguous hourly/benefit noise). */
function parseAmt(digits, k) {
  const hasComma = digits.includes(',');
  const n = Number(digits.replace(/,/g, ''));
  if (k) return n * 1000; // "135k"
  if (hasComma) return n; // "135,000"
  if (n >= 1000) return n; // "135000"
  return null; // bare "$50" — reject (likely hourly)
}

/** Extract an annual salary band from JD text. Returns {min,max} or null.
 *  Bounded to plausible annual figures (40k–600k) to avoid hourly/benefit noise. */
export function extractSalaryBand(text) {
  const re =
    /\$\s*(\d{2,3}(?:,\d{3})+|\d{2,6})\s*(k)?\s*(?:[-–—]|to)\s*\$?\s*(\d{2,3}(?:,\d{3})+|\d{2,6})\s*(k)?/gi;
  let best = null;
  for (const m of text.matchAll(re)) {
    const lo = parseAmt(m[1], m[2]);
    const hi = parseAmt(m[3], m[4]);
    if (lo == null || hi == null) continue;
    if (lo >= 40000 && hi <= 600000 && hi >= lo) {
      // Prefer the widest plausible band (usually the true comp range).
      if (!best || hi - lo > best.max - best.min) best = { min: lo, max: hi };
    }
  }
  return best;
}

/** GET board metadata ({name, content}) — used for existence + name-match checks. */
export async function fetchBoardMeta(token) {
  const r = await fetch(`${GH}/${encodeURIComponent(token)}`);
  if (!r.ok) return null;
  return r.json();
}

/** GET all jobs for a board (with JD content). Returns [] on empty, null on 404. */
export async function fetchGreenhouseJobs(token) {
  const r = await fetch(`${GH}/${encodeURIComponent(token)}/jobs?content=true`);
  if (!r.ok) return null;
  const j = await r.json();
  return Array.isArray(j.jobs) ? j.jobs : [];
}

/** Normalize one Greenhouse job → our job_posting shape, or null if not cleared. */
export function normalizeJob(job) {
  const title = String(job.title || '').trim();
  if (!title) return null;
  const text = stripHtml(job.content);
  const sig = clearanceSignal(title, text);
  if (!sig) return null; // cleared-defense app: skip non-cleared roles
  const loc = job.location?.name || '';
  const band = extractSalaryBand(text);
  const period = String(job.first_published || job.updated_at || '').slice(0, 7) || null;
  return {
    req_id: String(job.id),
    title,
    role_family: roleFamily(title),
    lcat_raw: job.departments?.[0]?.name || null,
    clearance_tier: sig.tier,
    metro: metroBucket(loc),
    location_raw: loc || null,
    remote: /remote/i.test(loc) || /remote/i.test(title),
    salary_min: band?.min ?? null,
    salary_max: band?.max ?? null,
    source_url: job.absolute_url || null,
    posted_period: period,
  };
}
