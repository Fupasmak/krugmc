import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { Prisma, User } from '@prisma/client';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'krug_session';
export const BROWSER_COOKIE = 'krug_browser';
export const CSRF_COOKIE = 'krug_csrf';

const SESSION_DAYS = 30;
const isProd = process.env.NODE_ENV === 'production';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };
}

/**
 * Идентификатор браузера. Нужен, чтобы вход подтверждался ровно для той
 * вкладки, которая его запросила: код из Minecraft или ссылка от бота,
 * перехваченные кем-то другим, чужую сессию не создадут.
 */
export async function getOrCreateBrowserToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(BROWSER_COOKIE)?.value;
  if (existing && /^[a-f0-9]{32,64}$/.test(existing)) return existing;

  const token = crypto.randomBytes(24).toString('hex');
  jar.set(BROWSER_COOKIE, token, { ...baseCookieOptions(), maxAge: 60 * 60 * 24 * 365 });
  return token;
}

export async function readBrowserToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(BROWSER_COOKIE)?.value ?? null;
}

export async function createSession(userId: string, ip: string | null, userAgent: string | null) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ip: ip ?? undefined,
      userAgent: userAgent?.slice(0, 255) ?? undefined,
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    ...baseCookieOptions(),
    expires: expiresAt,
  });
  // CSRF-токен намеренно доступен скриптам: фронт читает его и кладёт в заголовок.
  jar.set(CSRF_COOKIE, crypto.randomBytes(24).toString('hex'), {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return token;
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

export type SessionUser = User;

/**
 * Текущий пользователь или null. Кэшируется на время одного запроса,
 * чтобы десяток компонентов не делал десяток запросов в базу.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  return session.user;
}

export function sessionSelectSafe() {
  return {
    id: true,
    type: true,
    role: true,
    mcNickname: true,
    mcUuid: true,
    tgUsername: true,
    tgFirstName: true,
    tgPhotoUrl: true,
    cardFile: true,
  } satisfies Prisma.UserSelect;
}
