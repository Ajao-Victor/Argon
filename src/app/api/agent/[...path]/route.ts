import { NextResponse } from 'next/server';

/**
 * Same-origin GET proxy to the agent, used by src/services/agent.ts only after a direct
 * browser fetch fails with a network / CORS error. Runs on the server, where browser
 * CORS does not apply, so a Heroku FRONTEND_ORIGIN that does not match this deployment
 * cannot blank the dashboard. GET only, a strict path allowlist, no transformation, no
 * caching, and nothing but the public NEXT_PUBLIC_AGENT_URL is read (ENGINEERING.md §1.5).
 */
export const dynamic = 'force-dynamic';

const ALLOWED = [
  /^health$/,
  /^status$/,
  /^forecasts$/,
  /^forecasts\/latest$/,
  /^forecasts\/\d{1,12}$/,
  /^pools$/,
  /^vault$/,
  /^portfolio\/0x[0-9a-fA-F]{40}$/,
];

const UPSTREAM_TIMEOUT_MS = 30_000;

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const base = (process.env.NEXT_PUBLIC_AGENT_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) return NextResponse.json({ detail: 'agent not configured' }, { status: 503 });

  const { path } = await context.params;
  const joined = (path ?? []).join('/');
  if (!ALLOWED.some((re) => re.test(joined))) return NextResponse.json({ detail: 'path not allowed' }, { status: 404 });

  const search = new URL(request.url).search;
  // Only the forecasts list takes a query string, and only `limit`.
  const query = joined === 'forecasts' ? `?limit=${Math.min(168, Math.max(1, Number(new URLSearchParams(search).get('limit') ?? 24) || 24))}` : '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${base}/${joined}${query}`, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store', 'x-argon-proxy': '1' },
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError';
    return NextResponse.json({ detail: timedOut ? 'upstream timed out' : 'upstream unreachable' }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
