// Neon Postgres client for the production data layer. The @neondatabase/serverless
// driver talks to Neon over HTTP — ideal for Vercel serverless functions (no TCP
// pool exhaustion). Every API route queries Neon through q(); the browser never
// touches the database directly (SECURITY §8.1).
import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;

function client() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  _sql = neon(url);
  return _sql;
}

/** Parameterized query → rows. Uses $1,$2,… placeholders. */
export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const rows = await client().query(text, params);
  return rows as T[];
}
