import { proxy } from '@/lib/platform';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = async (req: Request) =>
  proxy('/api/comp/compare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
  });
