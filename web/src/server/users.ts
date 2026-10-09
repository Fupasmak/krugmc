import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { refreshUserSkin } from '@/lib/skin';
import { badRequest } from '@/lib/http';

/**
 * Игрок входит через Minecraft.
 *
 * Аккаунт ищем сначала по UUID, потом по нику в нижнем регистре: так
 * подхватывается карточка игрока, которого админ добавил заранее, и не
 * появляется дубль, если ник уже есть в базе.
 */
export async function upsertMinecraftUser(params: {
  uuid: string;
  nickname: string;
  textures?: string | null;
}): Promise<User> {
  const uuid = params.uuid.toLowerCase().replace(/-/g, '').replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    '$1-$2-$3-$4-$5',
  );
  const nickname = params.nickname;
  const nicknameLower = nickname.toLowerCase();
  const now = new Date();

  const isSuperadmin = nicknameLower === env.SUPERADMIN_NICKNAME.toLowerCase();

  const existing =
    (await prisma.user.findUnique({ where: { mcUuid: uuid } })) ??
    (await prisma.user.findUnique({ where: { mcNicknameLower: nicknameLower } }));

  let user: User;

  if (existing) {
    // Ник мог смениться: у записи с этим UUID обновляем ник.
    // Если ник занят другой записью, отдаём ошибку, разберётся админ.
    if (existing.mcNicknameLower !== nicknameLower) {
      const clash = await prisma.user.findUnique({ where: { mcNicknameLower: nicknameLower } });
      if (clash && clash.id !== existing.id) {
        throw badRequest('nickname_taken', 'Этот ник на сайте уже за другим аккаунтом. Напиши админам');
      }
    }
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        type: 'MC',
        mcUuid: uuid,
        mcNickname: nickname,
        mcNicknameLower: nicknameLower,
        firstLoginAt: existing.firstLoginAt ?? now,
        lastLoginAt: now,
        role: isSuperadmin ? 'SUPERADMIN' : existing.role,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        type: 'MC',
        role: isSuperadmin ? 'SUPERADMIN' : 'USER',
        mcUuid: uuid,
        mcNickname: nickname,
        mcNicknameLower: nicknameLower,
        firstLoginAt: now,
        lastLoginAt: now,
      },
    });
  }

  // Скин обновляем при каждом входе. Не вышло, не страшно, покажем прежний.
  await refreshUserSkin({ userId: user.id, texturesValue: params.textures ?? null, uuid });

  return user;
}

/** Зритель входит через Telegram. */
export async function upsertTelegramUser(params: {
  tgId: bigint;
  username?: string | null;
  firstName?: string | null;
  photoUrl?: string | null;
}): Promise<User> {
  const now = new Date();
  const data = {
    tgUsername: params.username ?? null,
    tgFirstName: params.firstName ?? null,
    tgPhotoUrl: params.photoUrl ?? null,
    lastLoginAt: now,
  };

  const existing = await prisma.user.findUnique({ where: { tgId: params.tgId } });
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data });
  }

  return prisma.user.create({
    data: {
      type: 'TG',
      tgId: params.tgId,
      ...data,
      firstLoginAt: now,
    },
  });
}

