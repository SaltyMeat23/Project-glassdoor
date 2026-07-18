// Shared CLI helpers for the valuation commands.

import { DEFAULT_PROFILES } from './assumptions.mjs';

const VALUE_FLAGS = new Set(['--profile', '--salary', '--contrib']);

/** Positional args (employer keys): bare args that are not flags nor flag values. */
export function parsePositionals(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { if (VALUE_FLAGS.has(a)) i++; continue; }
    out.push(a);
  }
  return out;
}

/** Parse profile flags from argv: --profile, --salary, --family/--single, --contrib. */
export function parseProfile(argv) {
  const base = { ...(DEFAULT_PROFILES[flag(argv, '--profile')] || DEFAULT_PROFILES['baseline-single']) };
  const salary = num(flag(argv, '--salary'));
  if (salary != null) base.salary = salary;
  if (argv.includes('--family')) base.family_status = 'family';
  if (argv.includes('--single')) base.family_status = 'single';
  const contrib = num(flag(argv, '--contrib'));
  if (contrib != null) base.contribution_rate = contrib > 1 ? contrib / 100 : contrib;
  base.label = `salary $${base.salary.toLocaleString()}, ${base.family_status}, ${Math.round(base.contribution_rate * 100)}% 401k`;
  return base;
}

/** Resolve an employer by slug (exact) or a case-insensitive name/slug match. */
export function resolveEmployer(db, key) {
  let e = db.prepare('SELECT id, slug, display_name, ownership FROM employer WHERE slug = ?').get(key);
  if (!e) {
    e = db.prepare(
      "SELECT id, slug, display_name, ownership FROM employer WHERE slug LIKE ? OR lower(display_name) LIKE ? LIMIT 1",
    ).get(`%${key}%`, `%${String(key).toLowerCase()}%`);
  }
  return e || null;
}

export const usd = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString());

const DRIVERS = [
  ['401(k)', ['k401_match', 'k401_auto_contribution']],
  ['PTO', ['pto']],
  ['Holidays', ['paid_holidays']],
  ['HSA', ['hsa_employer']],
  ['Medical premium', ['medical_employer_premium']],
  ['Dental/Vision', ['dental_vision']],
];

/** Compact per-employer coverage of the key drivers: ✓ employer-specific, ~ benchmark, ✗ missing. */
export function coverageLine(result) {
  const m = Object.fromEntries(result.lines.map((l) => [l.key, l]));
  return DRIVERS.map(([label, keys]) => {
    const present = keys.map((k) => m[k]).filter(Boolean);
    if (!present.length) return `${label} ✗`;
    if (present.some((l) => l.data_status === 'ok')) return `${label} ✓`;
    return `${label} ~`;
  }).join('  ');
}

function flag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}
function num(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}
