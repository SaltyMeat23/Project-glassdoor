// DEV-ONLY synthetic comp seed — lets us validate the benchmark engine before
// real crowdsourced data exists. Rows are written source/confidence='inferred'
// and are staleness-flagged (current period), so production logic treats them as
// low-confidence bootstrap, never as verified market truth. Idempotent: clears
// prior dev rows first. NOT run in production.
//
// Usage: node src/comp/seed-dev-comp.mjs

import { openDb } from '../lib/db.mjs';

// Deterministic PRNG (seeded LCG + Box-Muller) so the dev dataset is reproducible.
let _s = 1234567;
const rand = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const gauss = (mean, sd) => {
  const u = Math.max(rand(), 1e-9), v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const ROLE_BASE = {
  software_engineer: 150000, systems_engineer: 140000, cyber: 145000,
  intel_analyst: 110000, data_scientist: 160000, devops: 155000,
  program_manager: 145000, systems_administrator: 115000,
};
const CLEARANCE_ADJ = { secret: -10000, ts: -5000, ts_sci: 0, ts_sci_poly: 18000 };
const METRO_ADJ = { dc_metro: 0, huntsville: -8000, colorado_springs: -6000, denver_aurora: -5000, national_remote: -3000, other: -10000 };
const YOE_ADJ = { '0-2': -35000, '3-5': -18000, '6-9': 0, '10-14': 18000, '15+': 30000 };

const ROLES = Object.keys(ROLE_BASE);
const CLEARANCES = ['secret', 'ts_sci', 'ts_sci_poly'];
const METROS = ['dc_metro', 'huntsville', 'national_remote'];
const YOE = ['0-2', '3-5', '6-9', '10-14', '15+'];

const db = openDb();
db.exec("DELETE FROM comp_datapoint WHERE source = 'inferred'");
const ins = db.prepare(`
  INSERT INTO comp_datapoint (role_family, clearance_tier, metro, yoe_band, base, bonus, total_cash, source, confidence, submitted_period)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'inferred', 'inferred', ?)
`);
const period = new Date().toISOString().slice(0, 7);

let n = 0;
db.exec('BEGIN');
for (const role of ROLES) for (const clr of CLEARANCES) for (const metro of METROS) for (const yoe of YOE) {
  const mean = ROLE_BASE[role] + CLEARANCE_ADJ[clr] + METRO_ADJ[metro] + YOE_ADJ[yoe];
  // vary cell density: some cells thin (exercise the coarsening ladder), some dense
  const count = Math.floor(rand() * 14); // 0..13
  for (let i = 0; i < count; i++) {
    const base = Math.max(60000, Math.round(gauss(mean, mean * 0.11) / 1000) * 1000);
    const bonus = Math.round((base * (0.03 + rand() * 0.07)) / 500) * 500;
    ins.run(role, clr, metro, yoe, base, bonus, base + bonus, period);
    n++;
  }
}
db.exec('COMMIT');
console.log(`Seeded ${n} dev comp datapoints (source=inferred) across ${ROLES.length} roles × ${CLEARANCES.length} clearances × ${METROS.length} metros × ${YOE.length} yoe bands.`);
db.close();
