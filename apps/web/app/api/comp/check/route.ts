import { checkSchema, parseBody } from '@/lib/schemas';
import { resolveEmployer } from '@/lib/engine/employers';
import { submitComp } from '@/lib/engine/intake';
import { benchmark } from '@/lib/engine/benchmark';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Give-to-get: recording your comp (the "give") returns your benchmark (the "get").
export const POST = async (req: Request) => {
  const parsed = await parseBody(req, checkSchema);
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  const b = parsed.data;

  try {
    const emp = b.employer ? await resolveEmployer(b.employer) : null;
    const rec = await submitComp({
      role: b.role,
      clearance: b.clearance,
      metro: b.metro,
      yoe: b.yoe,
      base: b.base,
      bonus: b.bonus,
      employer_id: emp?.id ?? null,
      prime_sub: b.prime_sub,
      customer: b.customer,
      lcat: b.lcat,
    });
    if (!rec.ok) return Response.json({ ok: false, error: rec.error }, { status: 400 });

    const result = await benchmark({
      ...rec.cell,
      base: b.base ?? null,
      bonus: b.bonus ?? null,
      employer_id: emp?.id ?? null,
      employer_name: emp?.display_name ?? null,
      prime_sub: b.prime_sub ?? null,
      customer_sector: b.customer ?? null,
      lcat: b.lcat ?? null,
      family_status: b.family_status,
    });
    return Response.json({ ok: true, employer: emp?.display_name ?? null, ...result });
  } catch {
    return Response.json({ ok: false, error: 'data service unavailable' }, { status: 503 });
  }
};
