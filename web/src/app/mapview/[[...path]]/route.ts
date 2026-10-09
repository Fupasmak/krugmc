const PASS_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];

type Context = { params: Promise<{ path?: string[] }> };

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: Context) {
  const upstream = process.env.MAP_UPSTREAM_URL?.replace(/\/+$/, '');
  if (!upstream) return new Response('Not found', { status: 404 });

  const { path = [] } = await context.params;
  const search = new URL(request.url).search;
  const target = new URL(`${upstream}/${path.map(encodeURIComponent).join('/')}${search}`);
  if (!target.href.startsWith(`${upstream}/`)) return new Response('Bad path', { status: 400 });

  let response: Response;
  try {
    response = await fetch(target, { cache: 'no-store' });
  } catch {
    return new Response('Map unavailable', { status: 502 });
  }

  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  const type = response.headers.get('content-type') ?? '';
  if (path.length === 0 && type.includes('text/html')) {
    const html = (await response.text()).replace('<head>', '<head><base href="/mapview/">');
    return new Response(html, { status: response.status, headers });
  }

  return new Response(response.body, { status: response.status, headers });
}
