import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Карточка ищется двумя путями: сначала то, что записано в базе (загрузка
 * через админку), потом файл <ник>.png, положенный в public/cards руками.
 */
export function cardUrl(nicknameLower: string | null, cardFile: string | null): string {
  if (cardFile) return `/cards/${cardFile}`;
  if (nicknameLower) {
    const guess = path.resolve(process.cwd(), 'public', 'cards', `${nicknameLower}.png`);
    if (fs.existsSync(guess)) return `/cards/${nicknameLower}.png`;
  }
  return '/cards/_placeholder.png';
}

export type PlayerSort = 'nickname' | 'recent' | 'posts';

const playerSelect = {
  id: true,
  mcNickname: true,
  mcNicknameLower: true,
  mcUuid: true,
  cardFile: true,
  firstLoginAt: true,
  lastLoginAt: true,
  _count: { select: { posts: { where: { deletedAt: null } } } },
} satisfies Prisma.UserSelect;

export type PlayerListItem = Prisma.UserGetPayload<{ select: typeof playerSelect }>;

export async function listPlayers(params: {
  query?: string;
  sort?: PlayerSort;
}): Promise<PlayerListItem[]> {
  const query = params.query?.trim().toLowerCase();

  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    params.sort === 'recent'
      ? [{ firstLoginAt: { sort: 'desc', nulls: 'last' } }, { mcNicknameLower: 'asc' }]
      : params.sort === 'posts'
        ? [{ posts: { _count: 'desc' } }, { mcNicknameLower: 'asc' }]
        : [{ mcNicknameLower: 'asc' }];

  return prisma.user.findMany({
    where: {
      type: 'MC',
      hidden: false,
      ...(query ? { mcNicknameLower: { contains: query } } : {}),
    },
    orderBy,
    select: playerSelect,
    take: 300,
  });
}

export async function getPlayer(slug: string) {
  return prisma.user.findUnique({
    where: { mcNicknameLower: slug.toLowerCase() },
    select: {
      id: true,
      mcNickname: true,
      mcNicknameLower: true,
      mcUuid: true,
      cardFile: true,
      wikiText: true,
      tgChannel: true,
      hidden: true,
      role: true,
      firstLoginAt: true,
      lastLoginAt: true,
      _count: { select: { posts: { where: { deletedAt: null } } } },
    },
  });
}

/** Несколько случайных игроков, запасной вариант для главной. */
export async function randomPlayers(limit = 3): Promise<PlayerListItem[]> {
  const all = await prisma.user.findMany({
    where: { type: 'MC', hidden: false },
    select: playerSelect,
    take: 300,
  });

  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, limit);
}
