// Employer lookups against Neon.
import { q } from './db';

export type Employer = { id: number; slug: string; display_name: string; ownership: string | null };

export async function listEmployers(): Promise<{ slug: string; display_name: string }[]> {
  return q('SELECT slug, display_name FROM employer ORDER BY display_name');
}

/** Resolve by exact slug, else a loose name/slug match. */
export async function resolveEmployer(key: string | null | undefined): Promise<Employer | null> {
  if (!key) return null;
  const exact = await q<Employer>(
    'SELECT id, slug, display_name, ownership FROM employer WHERE slug = $1 LIMIT 1',
    [key]
  );
  if (exact.length) return exact[0];
  const like = `%${String(key).toLowerCase()}%`;
  const loose = await q<Employer>(
    'SELECT id, slug, display_name, ownership FROM employer WHERE slug LIKE $1 OR lower(display_name) LIKE $1 LIMIT 1',
    [like]
  );
  return loose[0] ?? null;
}
