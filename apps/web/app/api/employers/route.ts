import { listEmployers } from '@/lib/engine/employers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    return Response.json(await listEmployers());
  } catch {
    return Response.json({ error: 'data service unavailable' }, { status: 503 });
  }
};
