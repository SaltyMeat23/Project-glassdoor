// Comp normalization — bucket messy free-text into the benchmark cell
// (role_family × clearance_tier × metro × yoe_band) + the GovCon refinement dims
// (prime_sub, customer_sector, lcat). Runs at BOTH write-time (intake) and
// query-time (benchmark) so a query and its stored datapoints land in the same cell.
//
// SECURITY: metro buckets never encode a site/base (§7.2); clearance is a TIER,
// never a poly-scope/badge/number (§2); years are banded, never raw.
//
// Matching philosophy mirrors lib/normalize.mjs buildMatcher: canonicalize, then
// test patterns longest-first so the most specific alias wins.

/** Canonicalize free text: lowercase, non-alnum -> single space, trimmed. */
export function canon(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// --- role families ---------------------------------------------------------
// Ordered specific -> general; first pattern found as a substring wins. Keep
// more-specific families (cyber, intel) before generic engineering.
export const ROLE_SYNONYMS = [
  { family: 'cyber', patterns: ['cybersecurity', 'cyber security', 'information security', 'infosec', 'security engineer', 'security analyst', 'soc analyst', 'penetration tester', 'pentester', 'incident response', 'red team', 'vulnerability', ' isso', 'issm', 'rmf'] },
  { family: 'intel_analyst', patterns: ['all source', 'all-source', 'intelligence analyst', 'intel analyst', 'sigint', 'geoint', 'humint', 'osint', 'masint', 'imagery analyst', 'targeting analyst', 'cryptologic', 'counterintelligence'] },
  { family: 'data_scientist', patterns: ['data scientist', 'machine learning', 'ml engineer', 'data engineer', 'ai engineer', 'artificial intelligence'] },
  { family: 'devops', patterns: ['devops', 'devsecops', 'site reliability', 'sre', 'cloud engineer', 'platform engineer', 'kubernetes'] },
  { family: 'systems_administrator', patterns: ['system administrator', 'systems administrator', 'sysadmin', 'linux administrator', 'windows administrator'] },
  { family: 'network_engineer', patterns: ['network engineer', 'network administrator', 'network architect'] },
  { family: 'database_admin', patterns: ['database administrator', 'dba', 'database engineer'] },
  { family: 'systems_engineer', patterns: ['systems engineer', 'system engineer', 'systems integration', 'integration engineer'] },
  { family: 'test_engineer', patterns: ['test engineer', 'quality assurance', 'qa engineer', 'sdet', 'test automation'] },
  { family: 'hardware_engineer', patterns: ['hardware engineer', 'fpga', 'embedded engineer', 'embedded software', 'rf engineer', 'electrical engineer', 'firmware'] },
  { family: 'aerospace_engineer', patterns: ['aerospace engineer', 'mechanical engineer', 'flight software', 'gnc', 'propulsion'] },
  { family: 'systems_architect', patterns: ['solutions architect', 'enterprise architect', 'security architect', 'cloud architect', 'architect'] },
  { family: 'software_engineer', patterns: ['software engineer', 'software developer', 'full stack', 'fullstack', 'back end', 'backend', 'front end', 'frontend', 'swe', 'sde', 'programmer', 'developer'] },
  { family: 'program_manager', patterns: ['program manager', 'project manager', 'scrum master', 'product owner', 'product manager'] },
  { family: 'help_desk', patterns: ['help desk', 'service desk', 'desktop support', 'it support', 'field service'] },
];

export function roleFamily(raw) {
  const c = canon(raw);
  if (!c) return 'other';
  // longest pattern first across all families for specificity
  const all = ROLE_SYNONYMS.flatMap((r) => r.patterns.map((p) => ({ p: canon(p), family: r.family })))
    .sort((a, b) => b.p.length - a.p.length);
  for (const { p, family } of all) if (c.includes(p)) return family;
  return 'other';
}

// --- metros (dense cleared corridors; never a site/base) --------------------
export const METRO_ALIASES = [
  { metro: 'dc_metro', patterns: ['washington dc', 'washington', ' dc ', 'arlington', 'alexandria', 'reston', 'herndon', 'chantilly', 'mclean', 'tysons', 'fairfax', 'springfield', 'quantico', 'fort meade', 'ft meade', 'annapolis junction', 'laurel', 'columbia md', 'bethesda', 'northern virginia', 'nova', 'national capital'] },
  { metro: 'baltimore', patterns: ['baltimore', 'aberdeen', 'apg'] },
  { metro: 'huntsville', patterns: ['huntsville', 'madison al', 'redstone', 'hsv'] },
  { metro: 'colorado_springs', patterns: ['colorado springs', 'peterson', 'schriever', 'cheyenne mountain', 'norad'] },
  { metro: 'denver_aurora', patterns: ['denver', 'aurora', 'buckley', 'boulder'] },
  { metro: 'san_antonio', patterns: ['san antonio', 'lackland', 'jbsa'] },
  { metro: 'tampa', patterns: ['tampa', 'macdill'] },
  { metro: 'augusta', patterns: ['augusta', 'fort gordon', 'ft gordon', 'fort eisenhower'] },
  { metro: 'dayton', patterns: ['dayton', 'wright patterson', 'wpafb'] },
  { metro: 'st_louis', patterns: ['st louis', 'saint louis'] },
  { metro: 'la_socal', patterns: ['los angeles', 'el segundo', 'redondo', 'hawthorne'] },
  { metro: 'san_diego', patterns: ['san diego'] },
  { metro: 'boston', patterns: ['boston', 'lexington', 'bedford', 'hanscom', 'cambridge ma'] },
  { metro: 'national_remote', patterns: ['remote', 'telework', 'anywhere', 'work from home', 'wfh'] },
];

export function metroBucket(raw) {
  const c = canon(raw);
  if (!c) return 'other';
  const padded = ` ${c} `;
  const all = METRO_ALIASES.flatMap((m) => m.patterns.map((p) => ({ p: canon(p), metro: m.metro })))
    .filter((x) => x.p)
    .sort((a, b) => b.p.length - a.p.length);
  for (const { p, metro } of all) {
    // multi-word aliases (e.g. 'fort meade') match as substrings; single tokens
    // (e.g. 'dc', 'nova') require word boundaries to avoid 'innovation' -> 'nova'.
    const hit = p.includes(' ') ? c.includes(p) : padded.includes(` ${p} `);
    if (hit) return metro;
  }
  return 'other';
}

// --- years of experience -> band -------------------------------------------
export function yoeBand(years) {
  const y = Number(years);
  if (!Number.isFinite(y)) return null;
  if (y <= 2) return '0-2';
  if (y <= 5) return '3-5';
  if (y <= 9) return '6-9';
  if (y <= 14) return '10-14';
  return '15+';
}
export const YOE_BANDS = ['0-2', '3-5', '6-9', '10-14', '15+'];

// --- clearance tier (TIER only; poly implies SCI+) --------------------------
export function clearanceTier(raw) {
  const c = canon(raw);
  if (!c) return null;
  if (c.includes('poly') || c.includes('full scope') || c.includes('fsp') || c.includes('ci poly') || c.includes('lifestyle')) return 'ts_sci_poly';
  if (c.includes('sci') || c.includes('ts sci') || c.includes('tssci') || c.includes('sap')) return 'ts_sci';
  if (c.includes('top secret') || c === 'ts' || c.includes(' ts ') || c.startsWith('ts ') || c.endsWith(' ts')) return 'ts';
  if (c.includes('secret')) return 'secret';
  if (c.includes('public trust') || c.includes('none') || c.includes('no clearance')) return 'none';
  return null;
}
export const CLEARANCE_TIERS = ['none', 'secret', 'ts', 'ts_sci', 'ts_sci_poly'];

// --- coarse customer sector (never a specific program/agency at fine grain) --
export function customerSector(raw) {
  const c = canon(raw);
  if (!c) return null;
  if (['nsa', 'cia', 'nga', 'nro', 'dia', 'odni', 'fbi', 'intelligence community', ' ic '].some((k) => (` ${c} `).includes(k))) return 'ic';
  if (['dod', 'army', 'navy', 'air force', 'space force', 'marine', 'socom', 'darpa', 'disa', 'missile defense', 'mda', 'dla'].some((k) => c.includes(k))) return 'dod';
  if (['dhs', 'doj', 'state department', 'treasury', 'veterans', ' va ', 'hhs', 'faa', 'nasa', 'civilian'].some((k) => (` ${c} `).includes(k))) return 'civilian';
  return null;
}
export const CUSTOMER_SECTORS = ['dod', 'ic', 'civilian', 'other'];

// --- labor-category level (contract-specific seniority designation) ---------
export function lcatLevel(raw) {
  const c = canon(raw);
  if (!c) return null;
  if (/(principal|staff|distinguished|fellow| v | 5 |level 5)/.test(` ${c} `)) return 'principal';
  if (/(lead|senior|sr| iv | 4 |level 4)/.test(` ${c} `)) return 'senior';
  if (/(junior| jr | i | 1 |level 1|entry|associate)/.test(` ${c} `)) return 'junior';
  if (/( ii | iii | 2 | 3 |level 2|level 3|mid)/.test(` ${c} `)) return 'mid';
  return null;
}

// --- prime vs sub -----------------------------------------------------------
export function primeSub(raw) {
  const c = canon(raw);
  if (!c) return null;
  if (c.includes('sub')) return 'sub';
  if (c.includes('prime')) return 'prime';
  return null;
}
export const PRIME_SUB = ['prime', 'sub'];

/** Vocab lists for the data-driven intake form (served via /api/comp/meta). */
export const COMP_META = {
  role_families: [...new Set(ROLE_SYNONYMS.map((r) => r.family)), 'other'],
  metros: [...new Set(METRO_ALIASES.map((m) => m.metro)), 'other'],
  clearance_tiers: CLEARANCE_TIERS,
  yoe_bands: YOE_BANDS,
  customer_sectors: CUSTOMER_SECTORS,
  prime_sub: PRIME_SUB,
};
