// Serve a company's self-hosted logo from our own origin (SECURITY §8.2 — the
// browser never requests a logo from a third party). Bytes live in Neon; we
// fetched them server-side (platform/src/fetch-logos.mjs). Long-immutable cache.
import { q } from '@/lib/engine/db';

export const runtime = 'nodejs';

// Raster only — never serve image/svg+xml as active content on our own origin
// (an SVG can carry <script> → stored XSS). Coerce anything else to png.
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function toBuffer(v: unknown): Buffer | null {
  if (v == null) return null;
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === 'string') {
    // neon HTTP driver returns bytea as a "\x…"-prefixed hex string
    if (v.startsWith('\\x')) return Buffer.from(v.slice(2), 'hex');
    return Buffer.from(v, 'base64');
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const rows = await q<{ logo_bytes: unknown; logo_mime: string | null }>(
      'SELECT logo_bytes, logo_mime FROM employer WHERE slug = $1 LIMIT 1',
      [slug]
    );
    const buf = toBuffer(rows[0]?.logo_bytes);
    if (!buf) return new Response(null, { status: 404 });
    const mime = ALLOWED.has(rows[0].logo_mime ?? '') ? (rows[0].logo_mime as string) : 'image/png';
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': mime,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
        'content-disposition': 'inline; filename="logo"',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
