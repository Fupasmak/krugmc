import { prisma } from '@/lib/prisma';
import { ALLOWED_HEAD_SIZES, getDefaultHead, renderHead } from '@/lib/skin';

/**
 * Голова скина: /api/head/<uuid>.png?size=64
 * Можно спрашивать и по нику: /api/head/<ник>.png
 * Если скина нет: отдаём нарисованную нами голову по умолчанию.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  const name = decodeURIComponent(file).replace(/\.png$/i, '');

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get('size') ?? 64);
  const size = ALLOWED_HEAD_SIZES.includes(requested) ? requested : 64;

  const isUuid = /^[0-9a-fA-F-]{32,36}$/.test(name);
  const where = isUuid
    ? { mcUuid: name.toLowerCase() }
    : { mcNicknameLower: name.toLowerCase() };

  let head: Buffer | null = null;
  let updatedAt: Date | null = null;

  const user = await prisma.user.findUnique({
    where,
    select: { skin: { select: { headPng: true, updatedAt: true } } },
  });

  if (user?.skin) {
    head = Buffer.from(user.skin.headPng);
    updatedAt = user.skin.updatedAt;
  }

  const body = head ? await renderHead(head, size) : await renderHead(await getDefaultHead(), size);
  const etag = `"${name}-${size}-${updatedAt?.getTime() ?? 'default'}"`;

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      ETag: etag,
    },
  });
}
