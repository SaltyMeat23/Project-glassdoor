import { COMP_META } from '@/lib/engine/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = () => Response.json(COMP_META);
