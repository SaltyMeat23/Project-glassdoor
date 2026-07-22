// Quick connectivity check: prove we can reach Neon and read the schema.
// Run: cd platform && node --env-file=.env.local src/lib/ping-neon.mjs
import { q, close } from './db-postgres.mjs';

try {
  const ver = (await q('SELECT version()'))[0].version;
  console.log('✓ connected:', ver.split(' ').slice(0, 2).join(' '));
  const tables = await q(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  console.log(
    `  tables present: ${tables.length ? tables.map((t) => t.tablename).join(', ') : '(none yet — run migrate-neon)'}`
  );
} catch (e) {
  console.error('✗ could not connect:', e.message);
  process.exitCode = 1;
} finally {
  await close();
}
