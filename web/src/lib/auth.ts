import 'server-only';
import type { User } from '@prisma/client';
import { getSessionUser } from './session';
import { forbidden, unauthorized } from './http';

export async function currentUser(): Promise<User | null> {
  return getSessionUser();
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

/** Действия, доступные только игрокам сервера (вход через Minecraft). */
export async function requirePlayer(): Promise<User> {
  const user = await requireUser();
  if (user.type !== 'MC') {
    throw forbidden('Это умеют только игроки сервера');
  }
  return user;
}

/** Голосуют только зрители, вошедшие через Telegram. */
export async function requireViewer(): Promise<User> {
  const user = await requireUser();
  if (user.type !== 'TG') {
    throw forbidden('Голосуют зрители из Telegram. Игроки оценку не ставят');
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
    throw forbidden('Сюда пускают только администрацию');
  }
  return user;
}

export async function requireSuperadmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'SUPERADMIN') {
    throw forbidden('Это может только главный администратор');
  }
  return user;
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
}

export function displayName(user: {
  type: string;
  mcNickname: string | null;
  tgUsername: string | null;
  tgFirstName: string | null;
}): string {
  if (user.type === 'MC') return user.mcNickname ?? 'Игрок';
  return user.tgFirstName ?? (user.tgUsername ? `@${user.tgUsername}` : 'Зритель');
}
