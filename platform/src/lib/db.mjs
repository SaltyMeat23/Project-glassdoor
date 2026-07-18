// Thin wrapper around Node's built-in SQLite (node:sqlite, Node >= 22.5).
// File-based, zero native deps. Portable SQL migrates to Postgres later.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = resolve(__dirname, '..', '..', 'benefits.db');
const SCHEMA_PATH = resolve(__dirname, '..', '..', 'db', 'schema.sql');

/** Open (creating if needed) the database and ensure the schema is applied. */
export function openDb(path = DB_PATH) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}
