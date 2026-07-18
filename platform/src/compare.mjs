// Compare two employers' total rewards for the same profile — the core consumer
// surface (STRATEGY.md §6.1).
// Usage: node src/compare.mjs <employerA> <employerB> [--profile baseline-family] [--salary N] [--family|--single] [--contrib N]

import { openDb } from './lib/db.mjs';
import { valuate } from './valuation/engine.mjs';
import { parseProfile, parsePositionals, resolveEmployer, usd, coverageLine } from './valuation/cli-util.mjs';

const argv = process.argv.slice(2);
const keys = parsePositionals(argv);
if (keys.length < 2) {
  console.error('Usage: node src/compare.mjs <employerA> <employerB> [--profile ...] [--salary N] [--family|--single] [--contrib N]');
  process.exit(1);
}

const db = openDb();
const [ea, eb] = [resolveEmployer(db, keys[0]), resolveEmployer(db, keys[1])];
if (!ea) { console.error(`No employer matching "${keys[0]}".`); process.exit(1); }
if (!eb) { console.error(`No employer matching "${keys[1]}".`); process.exit(1); }
const profile = parseProfile(argv);
const [ra, rb] = [valuate(db, ea, profile), valuate(db, eb, profile)];

// union of line keys, in display order
const order = [];
for (const l of [...ra.lines, ...rb.lines]) if (!order.includes(l.key)) order.push(l.key);
const byKey = (r) => Object.fromEntries(r.lines.map((l) => [l.key, l]));
const [ma, mb] = [byKey(ra), byKey(rb)];
const labelOf = (k) => (ma[k] || mb[k]).label;

console.log(`\nProfile: ${profile.label}\n`);
const W = 40, C = 16;
console.log('  ' + 'Benefit'.padEnd(W) + ra.employer.name.slice(0, C - 1).padStart(C) + rb.employer.name.slice(0, C - 1).padStart(C) + 'Δ (A−B)'.padStart(12));
console.log('  ' + '-'.repeat(W + C * 2 + 12));
for (const k of order) {
  const va = ma[k]?.value ?? 0, vb = mb[k]?.value ?? 0;
  const d = va - vb;
  const flag = (ma[k]?.confidence === 'benchmark' || mb[k]?.confidence === 'benchmark') ? ' ~' : '';
  console.log('  ' + (labelOf(k) + flag).padEnd(W) + usd(ma[k]?.value).padStart(C) + usd(mb[k]?.value).padStart(C) + (d === 0 ? '—' : usd(d)).padStart(12));
}
console.log('  ' + '-'.repeat(W + C * 2 + 12));
const row = (label, a, b) => console.log('  ' + label.padEnd(W) + usd(a).padStart(C) + usd(b).padStart(C) + usd(a - b).padStart(12));
row('Benefits total', ra.subtotals.benefits_total, rb.subtotals.benefits_total);
row('Base pay', ra.subtotals.cash, rb.subtotals.cash);
row('TOTAL COMP', ra.subtotals.total_comp, rb.subtotals.total_comp);

const winner = ra.subtotals.total_comp >= rb.subtotals.total_comp ? ra : rb;
const delta = Math.abs(ra.subtotals.total_comp - rb.subtotals.total_comp);
console.log(`\n  → ${winner.employer.name} leads by ${usd(delta)} total comp for this profile.`);
console.log(`\n  Data coverage (✓ employer-specific · ~ benchmark · ✗ missing):`);
console.log(`    ${ra.employer.name}: ${coverageLine(ra)}`);
console.log(`    ${rb.employer.name}: ${coverageLine(rb)}`);
console.log('  A "✗ missing" line shows as — above and understates that employer — it is a data gap, not a zero benefit.');
db.close();
