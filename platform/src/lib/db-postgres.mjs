// Postgres (Neon) connection for migrations + production data access.
// Reads DATABASE_URL from the environment (load via `node --env-file=.env.local`).
// Neon requires TLS; the connection string includes ?sslmode=require.

import pg from 'pg';

const { Pool } = pg;

let _pool = null;

export function pool() {
  if (_pool) return _pool;
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    throw new Error(
      'DATABASE_URL is not set. Put it in platform/.env.local and run with: node --env-file=.env.local <script>'
    );
  }
  _pool = new Pool({
    connectionString: cs,
    // Neon serves publicly-trusted certs — verify them (no MITM window).
    ssl: { rejectUnauthorized: true },
    max: 4,
  });
  return _pool;
}

/** Run a query, returning rows. */
export async function q(text, params = []) {
  const res = await pool().query(text, params);
  return res.rows;
}

export async function close() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
