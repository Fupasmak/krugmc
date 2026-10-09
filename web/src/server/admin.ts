import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound } from '@/lib/http';

export async function audit(params: {
  actor: User | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actor?.id ?? null,
      action: params.action,
      target: params.target ?? null,
      meta: params.meta as never,
    },
  });
}

/** Найти игрока по нику, используется в формах архива и медиа. */
export async function findPlayerByNickname(nickname: string) {
  const user = await prisma.user.findUnique({
    where: { mcNicknameLower: nickname.toLowerCase() },
  });
  if (!user) throw notFound(`Игрок ${nickname} не найден`);
  return user;
}

/**
 * Игрок, добавленный админом заранее: аккаунт есть, входа ещё не было.
 * Когда человек зайдёт на сервер и подтвердит вход, запись подхватится
 * по нику, и карточка останется той же.
 */
export async function createPlaceholderPlayer(params: {
  nickname: string;
  actor: User;
  wikiText?: string | null;
}) {
  const nicknameLower = params.nickname.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { mcNicknameLower: nicknameLower } });
  if (existing) throw badRequest('player_exists', 'Игрок с таким ником уже есть');

  const user = await prisma.user.create({
    data: {
      type: 'MC',
      mcNickname: params.nickname,
      mcNicknameLower: nicknameLower,
      wikiText: params.wikiText ?? null,
      createdById: params.actor.id,
    },
  });

  await audit({ actor: params.actor, action: 'player.create', target: params.nickname });
  return user;
}
