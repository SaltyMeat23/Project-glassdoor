// Server-side access to the ContractIQ platform data API. In dev this is the
// node:http server (npm run serve, :8787); in production it becomes the Neon-
// backed data layer. The browser never talks to it directly — only these
// Next server routes do — so the data API stays localhost-bound (SECURITY §8.1).
export const PLATFORM = process.env.PLATFORM_API ?? 'http://127.0.0.1:8787';

export async function proxy(path: string, init?: RequestInit): Promise<Response> {
  try {
    const r = await fetch(`${PLATFORM}${path}`, { cache: 'no-store', ...init });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: "The data service isn't running. Start it with: cd platform && npm run serve",
      }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }
}
