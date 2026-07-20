import { proxy } from '@/lib/platform';
import { compareSchema, parseBody } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = async (req: Request) => {
  const parsed = await parseBody(req, compareSchema);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  return proxy('/api/comp/compare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });
};
