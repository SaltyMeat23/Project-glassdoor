// "How do I compare?" — CLI to exercise the comp benchmark before any UI.
// Usage:
//   node src/comp-check.mjs --role "Software Engineer" --clearance "TS/SCI" \
//        --metro "Reston, VA" --yoe 7 --base 150000 [--bonus 12000] \
//        [--employer lockheed-martin] [--prime-sub sub] [--customer NSA] [--lcat "Engineer III"] [--k 5]

import { openDb } from './lib/db.mjs';
import { benchmark } from './comp/benchmark.mjs';
import { roleFamily, metroBucket, yoeBand, clearanceTier, customerSector, lcatLevel, primeSub } from './comp/normalize-comp.mjs';
import { resolveEmployer, usd } from './valuation/cli-util.mjs';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null; };

const db = openDb();
const emp = flag('--employer') ? resolveEmployer(db, flag('--employer')) : null;
const query = {
  role_family: roleFamily(flag('--role')),
  clearance_tier: clearanceTier(flag('--clearance')),
  metro: metroBucket(flag('--metro')),
  yoe_band: yoeBand(Number(flag('--yoe'))),
  base: flag('--base') ? Number(flag('--base')) : null,
  bonus: flag('--bonus') ? Number(flag('--bonus')) : null,
  employer_id: emp?.id ?? null,
  prime_sub: flag('--prime-sub') ? primeSub(flag('--prime-sub')) : null,
  customer_sector: flag('--customer') ? customerSector(flag('--customer')) : null,
  lcat: flag('--lcat') ? lcatLevel(flag('--lcat')) : null,
};
const k = flag('--k') ? Number(flag('--k')) : 5;

console.log(`\nQuery cell: ${[query.role_family, query.clearance_tier, query.metro, query.yoe_band].join(' · ')}` +
  (emp ? `  @ ${emp.display_name}` : '') +
  (query.base ? `   your offer: base ${usd(query.base)}${query.bonus ? ' + bonus ' + usd(query.bonus) : ''}` : ''));

const r = benchmark(db, query, { k });

if (r.status === 'insufficient') {
  console.log(`\n  Not enough data yet for "${r.cell}" (have ${r.have}, need k=${r.k}).`);
  console.log(`  → Be the first to seed this cell — contribute your comp to unlock the benchmark.`);
  db.close();
  process.exit(0);
}

const d = r.distribution;
console.log(`\n  Market base pay  (n=${r.n}${r.approximate ? ', approximate' : ''}${r.coarsened ? `, widened to: ${r.level}` : ''})`);
console.log(`    p25 ${usd(d.p25)}   p50 ${usd(d.p50)}   p75 ${usd(d.p75)}   p90 ${usd(d.p90)}`);
if (r.base_percentile != null) console.log(`    You are at the ${ord(r.base_percentile)} percentile for base pay.`);
if (r.total_cash_percentile != null) console.log(`    Total cash (base+bonus): ${ord(r.total_cash_percentile)} percentile.`);
if (r.verdict) console.log(`\n  ▶ ${r.verdict.text}`);

if (r.benefits) {
  const b = r.benefits;
  console.log(`\n  + Benefits add-on${b.employer ? ` (${b.employer})` : ' (sector benchmark)'}: ${usd(b.benefits_total)}/yr`);
  for (const l of b.lines) console.log(`      ${l.label.padEnd(34)} ${usd(l.value).padStart(10)}  [${l.confidence}]`);
  if (b.gaps?.length) console.log(`      (benchmark/estimate: ${b.gaps.join(', ')})`);
  if (query.base) console.log(`    ≈ total-rewards value: ${usd(query.base + (query.bonus || 0) + (b.benefits_total || 0))}/yr`);
}
console.log('\n  Note: pay in GovCon varies most by contract — refine with --prime-sub / --customer / --lcat as data grows.');
db.close();

function ord(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
