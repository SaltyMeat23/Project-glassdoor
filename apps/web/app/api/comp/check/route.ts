import { proxy } from '@/lib/platform';
import { checkSchema, parseBody } from '@/lib/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = async (req: Request) => {
  const parsed = await parseBody(req, checkSchema);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  return proxy('/api/comp/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });
};
