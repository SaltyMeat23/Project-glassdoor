import { searchCompanies } from '@/lib/engine/companies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0') || 0);
  try {
    return Response.json(await searchCompanies({ q, page }));
  } catch {
    return Response.json({ error: 'data service unavailable' }, { status: 503 });
  }
};
