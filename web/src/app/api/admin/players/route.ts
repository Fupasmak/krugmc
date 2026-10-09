import { handler, jsonOk } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { adminPlayerSchema } from '@/lib/validation';
import { createPlaceholderPlayer } from '@/server/admin';

export const dynamic = 'force-dynamic';

/** Список всех игроков для админки, включая скрытых и ещё не заходивших. */
export const GET = handler(async (request) => {
  await requireAdmin();
  const query = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? '';

  const players = await prisma.user.findMany({
    where: {
      type: 'MC',
      ...(query ? { mcNicknameLower: { contains: query } } : {}),
    },
    orderBy: [{ mcNicknameLower: 'asc' }],
    select: {
      id: true,
      mcNickname: true,
      mcNicknameLower: true,
      mcUuid: true,
      cardFile: true,
      hidden: true,
      role: true,
      firstLoginAt: true,
      lastLoginAt: true,
      _count: { select: { posts: true } },
    },
    take: 500,
  });

  return jsonOk({
    players: players.map((player) => ({
      ...player,
      firstLoginAt: player.firstLoginAt?.toISOString() ?? null,
      lastLoginAt: player.lastLoginAt?.toISOString() ?? null,
      posts: player._count.posts,
    })),
  });
});

/** Добавить игрока, который ещё не заходил. */
export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const input = adminPlayerSchema.parse(await request.json());
  const player = await createPlaceholderPlayer({
    nickname: input.nickname,
    wikiText: input.wikiText ?? null,
    actor,
  });

  return jsonOk(
    {
      player: {
        id: player.id,
        nickname: player.mcNickname,
        slug: player.mcNicknameLower,
      },
    },
    { status: 201 },
  );
});
