import { handler, jsonOk, badRequest } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { mediaItemSchema } from '@/lib/validation';
import { audit, findPlayerByNickname } from '@/server/admin';
import { parseVideoUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdmin();
  const items = await prisma.mediaItem.findMany({
    orderBy: { publishedAt: 'desc' },
    include: { author: { select: { mcNickname: true } }, week: { select: { number: true } } },
    take: 300,
  });
  return jsonOk({
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      author: item.author?.mcNickname ?? null,
      week: item.week?.number ?? null,
      publishedAt: item.publishedAt.toISOString(),
    })),
  });
});

export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const input = mediaItemSchema.parse(await request.json());
  const parsed = parseVideoUrl(input.url);
  if (parsed.provider === 'unknown') {
    throw badRequest('bad_video_url', 'Поддерживаются ссылки YouTube и VK');
  }

  const author = input.authorNickname ? await findPlayerByNickname(input.authorNickname) : null;
  const week =
    input.weekNumber != null
      ? await prisma.archiveWeek.findUnique({ where: { number: input.weekNumber } })
      : null;

  const item = await prisma.mediaItem.create({
    data: {
      title: input.title,
      url: input.url,
      thumbnail: parsed.thumbnail,
      description: input.description ?? null,
      authorId: author?.id ?? null,
      weekId: week?.id ?? null,
    },
  });

  await audit({ actor, action: 'media.create', target: item.title });
  return jsonOk({ item: { id: item.id } }, { status: 201 });
});
