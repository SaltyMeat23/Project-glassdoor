// Summarize what the seed produced: coverage per employer + plan-type mix.
// Usage: node src/report.mjs

import { openDb } from './lib/db.mjs';

const db = openDb();

const totalPlans = db.prepare('SELECT COUNT(*) c FROM benefit_plan').get().c;
const totalEmp = db.prepare('SELECT COUNT(*) c FROM employer').get().c;
const covered = db.prepare('SELECT COUNT(DISTINCT employer_id) c FROM benefit_plan').get().c;

console.log(`\nSeed coverage`);
console.log(`  employers in seed set: ${totalEmp}`);
console.log(`  employers with >=1 plan found: ${covered}`);
console.log(`  benefit plans ingested: ${totalPlans.toLocaleString()}`);

console.log(`\nPlan-type mix`);
for (const r of db.prepare(
  'SELECT plan_type, COUNT(*) c FROM benefit_plan GROUP BY plan_type ORDER BY c DESC',
).all()) {
  console.log(`  ${String(r.plan_type).padEnd(16)} ${String(r.c).padStart(5)}`);
}

console.log(`\nPer-employer coverage (plans | DB pension | 401k | health)`);
const rows = db.prepare(`
  SELECT e.display_name AS name, e.ownership AS own,
         COUNT(p.id) AS plans,
         SUM(CASE WHEN p.plan_type='db_pension' THEN 1 ELSE 0 END) AS db,
         SUM(CASE WHEN p.plan_type='401k' THEN 1 ELSE 0 END) AS k401,
         SUM(CASE WHEN p.plan_type='health_welfare' THEN 1 ELSE 0 END) AS health
  FROM employer e LEFT JOIN benefit_plan p ON p.employer_id = e.id
  GROUP BY e.id ORDER BY plans DESC, name
`).all();
for (const r of rows) {
  const flag = r.plans === 0 ? '  (no match)' : '';
  const dbFlag = r.db > 0 ? ' *DB*' : '';
  console.log(
    `  ${r.name.padEnd(34)} ${String(r.plans).padStart(3)} | ${String(r.db).padStart(2)} | ${String(r.k401).padStart(2)} | ${String(r.health).padStart(2)}  ${r.own}${dbFlag}${flag}`,
  );
}

db.close();
