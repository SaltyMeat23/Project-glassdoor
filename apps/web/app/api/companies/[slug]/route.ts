import { getCompanyProfile } from '@/lib/engine/companies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  try {
    const profile = await getCompanyProfile(slug);
    if (!profile) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json(profile);
  } catch {
    return Response.json({ error: 'data service unavailable' }, { status: 503 });
  }
};
