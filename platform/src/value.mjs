// Value one employer's total rewards for a profile.
// Usage: node src/value.mjs <employer> [--profile baseline-family] [--salary 140000] [--family|--single] [--contrib 10]

import { openDb } from './lib/db.mjs';
import { valuate } from './valuation/engine.mjs';
import { parseProfile, parsePositionals, resolveEmployer, usd, coverageLine } from './valuation/cli-util.mjs';

const argv = process.argv.slice(2);
const key = parsePositionals(argv)[0];
if (!key) {
  console.error('Usage: node src/value.mjs <employer> [--profile baseline-family] [--salary N] [--family|--single] [--contrib N]');
  process.exit(1);
}

const db = openDb();
const emp = resolveEmployer(db, key);
if (!emp) { console.error(`No employer matching "${key}".`); process.exit(1); }
const profile = parseProfile(argv);
const r = valuate(db, emp, profile);

const conf = (c) => ({ verified: '✓verified', reported: 'reported', inferred: 'inferred', benchmark: '~benchmark' }[c] || c);

console.log(`\n${r.employer.name}  (${r.employer.ownership})`);
console.log(`Profile: ${profile.label}\n`);
console.log('  ' + 'Benefit'.padEnd(40) + 'Annual value'.padStart(14) + '   Confidence   Basis');
console.log('  ' + '-'.repeat(88));
for (const l of r.lines) {
  console.log('  ' + l.label.padEnd(40) + usd(l.value).padStart(14) + '   ' + conf(l.confidence).padEnd(11) + '  ' + l.basis);
  if (l.note) console.log('  ' + ' '.repeat(40) + '                 ↳ ' + l.note);
}
console.log('  ' + '-'.repeat(88));
const st = r.subtotals;
console.log('  ' + 'Employer-specific benefits'.padEnd(40) + usd(st.benefits_employer_specific).padStart(14));
console.log('  ' + 'Benchmark-estimated benefits'.padEnd(40) + usd(st.benefits_benchmark).padStart(14) + '   (' + r.gaps.join(', ') + ')');
console.log('  ' + 'Benefits total'.padEnd(40) + usd(st.benefits_total).padStart(14));
console.log('  ' + `Base pay`.padEnd(40) + usd(st.cash).padStart(14));
console.log('  ' + 'TOTAL COMP (pay + benefits)'.padEnd(40) + usd(st.total_comp).padStart(14));
const pct = ((st.benefits_total / st.cash) * 100).toFixed(0);
console.log(`\n  Benefits add ~${pct}% on top of base pay.`);
console.log('  Data coverage: ' + coverageLine(r) + '   (✓ employer-specific · ~ benchmark · ✗ missing)');
console.log('  Note: "benchmark" lines are NOT employer-specific — they are the priority scrape/crowdsource gaps.');
db.close();
