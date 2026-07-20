import { proxy } from '@/lib/platform';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = () => proxy('/api/comp/meta');
