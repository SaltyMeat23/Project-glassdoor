// iCIMS public careers adapter — the ATS of the small/mid cleared contractor
// (American Systems, Amyx, Peraton, …). No JSON API: we parse the public search
// HTML (the `in_iframe=1` view), narrowed to cleared roles via searchKeyword.
// Structured fields + source link only, never the raw JD (docs/JOBS.md §3).
import { metroBucket, roleFamily } from '../comp/normalize-comp.mjs';
import { clearanceSignal, tierFromText } from './ats-greenhouse.mjs';

function decode(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&ndash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse one iCIMS search-results page into job rows. */
export function parseIcimsRows(html) {
  const re = /href="([^"]*\/jobs\/(\d+)\/[^"]*\/job[^"]*)"[^>]*title="\d+\s*-\s*([^"]+)"/gi;
  const matches = [...html.matchAll(re)];
  const rows = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const block = html.slice(m.index, matches[i + 1]?.index ?? m.index + 2000);
    const locM = block.match(/US-([A-Z]{2})-([^<]+)/);
    const location = locM
      ? `${decode(locM[2])}, ${locM[1]}`
      : block.match(/>([^<]*Remote[^<]*)</i)?.[1]?.trim() || '';
    const descM = block.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    rows.push({
      id: m[2],
      href: m[1].replace(/&amp;/g, '&').split('?')[0],
      title: decode(m[3]),
      location,
      desc: descM ? decode(descM[1]) : '',
    });
  }
  return rows;
}

/** Fetch cleared postings for an iCIMS tenant (subdomain, e.g. "careers-peraton"). */
export async function fetchIcimsCleared(sub, { maxPages = 15 } = {}) {
  const base = `https://${sub}.icims.com/jobs/search`;
  const out = [];
  for (let pr = 0; pr < maxPages; pr++) {
    const url = `${base}?pr=${pr}&in_iframe=1&searchKeyword=clearance&searchRelation=keyword_all`;
    let html;
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!r.ok) break;
      html = await r.text();
    } catch {
      break;
    }
    const rows = parseIcimsRows(html);
    if (!rows.length) break;
    out.push(...rows);
    if (!/rel="next"/i.test(html)) break;
  }
  return out;
}

/** Normalize one iCIMS row → our job_posting shape. searchKeyword=clearance
 *  establishes it's a cleared role; tier from title/desc where present. */
export function normalizeIcimsJob(job, sub) {
  const title = job.title;
  if (!title) return null;
  const sig = clearanceSignal(title, job.desc || '');
  const tier = sig?.tier ?? tierFromText(title) ?? tierFromText(job.desc || '');
  const loc = job.location || '';
  const url = job.href.startsWith('http') ? job.href : `https://${sub}.icims.com${job.href}`;
  return {
    req_id: job.id,
    title,
    role_family: roleFamily(title),
    lcat_raw: null,
    clearance_tier: tier,
    metro: metroBucket(loc),
    location_raw: loc || null,
    remote: /remote/i.test(loc) || /remote/i.test(title),
    salary_min: null,
    salary_max: null,
    source_url: url,
    posted_period: null,
  };
}
