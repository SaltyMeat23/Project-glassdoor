// Migrate the local SQLite dataset into Neon Postgres.
//   1. apply db/schema.postgres.sql (idempotent)
//   2. copy every table from benefits.db → Neon, preserving ids + FKs
//   3. reset each IDENTITY sequence past the max id
//
// Run:  cd platform && node --env-file=.env.local src/migrate-postgres.mjs
//       (add --fresh to TRUNCATE the Neon tables first; --skip-dev-comp to
//        exclude the synthetic source='inferred' comp rows.)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { openDb } from './lib/db.mjs';
import { pool, q, close } from './lib/db-postgres.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(__dirname, '..', 'db', 'schema.postgres.sql');

const FRESH = process.argv.includes('--fresh');
const SKIP_DEV_COMP = process.argv.includes('--skip-dev-comp');

// FK-safe order: parents before children.
const TABLES = [
  'employer',
  'employer_alias',
  'benefit_plan',
  'plan_terms',
  'submission',
  'valuation_profile',
  'comp_datapoint',
  'ingest_run',
];

const sqlite = openDb();
const cols = (t) => sqlite.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);

async function applySchema() {
  const ddl = readFileSync(SCHEMA, 'utf8');
  await pool().query(ddl);
  console.log('✓ schema applied');
}

async function copyTable(t) {
  const c = cols(t);
  let rows = sqlite.prepare(`SELECT ${c.join(', ')} FROM ${t}`).all();
  if (t === 'comp_datapoint' && SKIP_DEV_COMP) {
    rows = rows.filter((r) => r.source !== 'inferred');
  }
  if (FRESH) await q(`TRUNCATE ${t} RESTART IDENTITY CASCADE`);
  if (!rows.length) {
    console.log(`  ${t.padEnd(18)} 0 rows`);
    return;
  }
  // chunked multi-row INSERT ... OVERRIDING SYSTEM VALUE (preserve ids)
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const params = [];
    const tuples = batch.map((row) => {
      const ph = c.map((col) => {
        params.push(row[col] ?? null);
        return `$${params.length}`;
      });
      return `(${ph.join(', ')})`;
    });
    await q(
      `INSERT INTO ${t} (${c.join(', ')}) OVERRIDING SYSTEM VALUE VALUES ${tuples.join(', ')}`,
      params
    );
    written += batch.length;
  }
  // bump the identity sequence past the max id we just inserted
  await q(
    `SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${t}))`
  );
  console.log(`  ${t.padEnd(18)} ${written} rows`);
}

async function main() {
  const ver = (await q('SELECT version()'))[0].version;
  console.log('Connected:', ver.split(',')[0]);
  await applySchema();
  console.log(`\nCopying data${FRESH ? ' (--fresh: truncating first)' : ''}${SKIP_DEV_COMP ? ' (skipping synthetic comp)' : ''}:`);
  for (const t of TABLES) await copyTable(t);

  console.log('\nNeon row counts:');
  for (const t of TABLES) {
    const n = (await q(`SELECT COUNT(*)::int AS c FROM ${t}`))[0].c;
    console.log(`  ${t.padEnd(18)} ${n}`);
  }
  sqlite.close();
  await close();
  console.log('\n✓ migration complete');
}

main().catch(async (e) => {
  console.error('\n✗ migration failed:', e.message);
  await close();
  process.exit(1);
});
