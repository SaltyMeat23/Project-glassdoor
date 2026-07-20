// Zero-trust input validation for the comp API (SECURITY §5). Every client
// payload is parsed against a Zod schema at the Next server boundary before it
// reaches the engine: unknown keys are stripped, strings are length-capped,
// numbers are coerced and bounded, and arrays are size-limited. Reject early
// with a clear message; never forward raw client input downstream.

import { z } from 'zod';

// A short free-text field (role title, LCAT). Trimmed, capped, optional.
const shortText = z.string().trim().max(120).optional();

// A controlled-vocabulary token (clearance, metro, prime_sub, customer). The
// engine normalizes these server-side, so accept bounded text rather than a
// hard enum — but cap length to prevent abuse.
const token = z.string().trim().max(40).optional();

// Money: coerce "150000" | 150000 → number, reject negative / absurd / NaN.
const money = z.coerce.number().finite().min(0).max(5_000_000).optional();

// Years of experience: 0–60, coerced.
const yoe = z.coerce.number().finite().min(0).max(60).optional();

const familyStatus = z.enum(['single', 'family']).optional();

// Fields shared by the single-check and the A/B compare (the "your profile" block).
const profile = {
  role: shortText,
  clearance: token,
  metro: token,
  yoe,
  prime_sub: token,
  customer: token,
  lcat: shortText,
  family_status: familyStatus,
};

// POST /api/comp/check — one offer benchmarked against the market.
export const checkSchema = z.object({
  ...profile,
  base: money,
  bonus: money,
  employer: z.string().trim().max(80).optional(),
});
export type CheckInput = z.infer<typeof checkSchema>;

// One offer inside the A/B compare.
const offerSchema = z.object({
  label: z.string().trim().max(60).optional(),
  employer: z.string().trim().max(80).optional(),
  base: money,
  bonus: money,
});

// POST /api/comp/compare — two offers, same profile, side by side.
export const compareSchema = z.object({
  ...profile,
  offers: z.array(offerSchema).min(1).max(2),
});
export type CompareInput = z.infer<typeof compareSchema>;

/**
 * Parse a JSON request body against a schema.
 * Returns { ok: true, data } or { ok: false, error } (a flat, user-safe message).
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, error: 'Request body must be valid JSON.' };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join('.') || 'input';
    return { ok: false, error: `Invalid ${where}: ${first?.message ?? 'bad value'}.` };
  }
  return { ok: true, data: result.data };
}
