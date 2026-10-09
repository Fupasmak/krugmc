import 'server-only';
import crypto from 'node:crypto';
import type { TokenPurpose } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound } from '@/lib/http';

export const LOGIN_CODE_TTL_MS = 5 * 60 * 1000;
export const TG_TOKEN_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

/**
 * Сколько живёт уже подтверждённый вход, пока его не забрала вкладка.
 * Без этого окна подтверждение годилось бы вечно.
 */
export const CONFIRMATION_TTL_MS = 15 * 60 * 1000;

/** Подробные записи только в разработке: в проде лог чистый. */
const devLog = (message: string, data?: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== 'development') return;
  console.log(`[login] ${message}`, data ?? '');
};

// Буквы и цифры без похожих друг на друга: ноль, O, I, единица.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

/** Код для входа через Minecraft. Один браузер, один активный код. */
export async function createLoginCode(browserToken: string, ip: string | null) {
  await prisma.loginCode.deleteMany({ where: { browserToken } });

  const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MS);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    try {
      const created = await prisma.loginCode.create({
        data: { code, browserToken, expiresAt, ip: ip ?? undefined },
      });
      devLog('выдан код для входа из игры', {
        code: created.code,
        browser: browserToken.slice(0, 8),
        createdUtc: created.createdAt.toISOString(),
        expiresUtc: created.expiresAt.toISOString(),
      });
      return created;
    } catch {
      // код случайно совпал с живым, пробуем ещё раз
    }
  }
  throw badRequest('code_generation_failed', 'Не получилось создать код, попробуй ещё раз');
}

/** Токен для входа или привязки через Telegram. */
export async function createTgToken(params: {
  browserToken: string;
  purpose: TokenPurpose;
  targetUserId?: string | null;
  ip: string | null;
}) {
  await prisma.tgLoginToken.deleteMany({
    where: { browserToken: params.browserToken, purpose: params.purpose, status: 'PENDING' },
  });

  // Токен только из hex: Telegram пропускает в ?start= лишь A-Z a-z 0-9 _ -
  // и не длиннее 64 символов. «login_» плюс 48 знаков это 54, укладываемся.
  const created = await prisma.tgLoginToken.create({
    data: {
      token: crypto.randomBytes(24).toString('hex'),
      purpose: params.purpose,
      browserToken: params.browserToken,
      targetUserId: params.targetUserId ?? undefined,
      expiresAt: new Date(Date.now() + TG_TOKEN_TTL_MS),
      ip: params.ip ?? undefined,
    },
  });

  devLog('выдан токен для Telegram', {
    token: `${created.token.slice(0, 8)}...`,
    length: created.token.length,
    purpose: created.purpose,
    browser: params.browserToken.slice(0, 8),
    createdUtc: created.createdAt.toISOString(),
    expiresUtc: created.expiresAt.toISOString(),
  });

  return created;
}

export type PendingSource = 'mc' | 'tg';

export type PendingState =
  | { kind: 'none' }
  | { kind: 'pending'; source: PendingSource; expiresAt: Date }
  | { kind: 'confirmed'; source: PendingSource; purpose: 'LOGIN' | 'LINK' }
  | { kind: 'expired'; source: PendingSource };

/**
 * Что сейчас происходит с входом в этом браузере.
 *
 * Порядок важен: сначала ищем подтверждение любым способом, потом живое
 * ожидание, и только если ничего живого нет, сообщаем об истёкшем.
 * Раньше первым проверялся код Minecraft, и один протухший код в браузере
 * обрывал вход через Telegram, хотя токен был уже подтверждён.
 */
export async function getPendingState(browserToken: string): Promise<PendingState> {
  const now = new Date();

  const [code, token] = await Promise.all([
    prisma.loginCode.findFirst({
      where: { browserToken, status: { in: ['PENDING', 'CONFIRMED'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tgLoginToken.findFirst({
      where: { browserToken, status: { in: ['PENDING', 'CONFIRMED'] } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  devLog('состояние входа', {
    browser: browserToken.slice(0, 8),
    code: code ? { status: code.status, expiresAt: code.expiresAt.toISOString() } : null,
    token: token
      ? { status: token.status, purpose: token.purpose, expiresAt: token.expiresAt.toISOString() }
      : null,
    nowUtc: now.toISOString(),
  });

  // 1. Подтверждение важнее всего. Если подтверждены оба, берём свежее.
  const fresh = (at: Date | null) => at !== null && now.getTime() - at.getTime() < CONFIRMATION_TTL_MS;

  const codeConfirmedRaw = code?.status === 'CONFIRMED' ? (code.confirmedAt ?? code.createdAt) : null;
  const tokenConfirmedRaw =
    token?.status === 'CONFIRMED' ? (token.confirmedAt ?? token.createdAt) : null;

  const codeConfirmedAt = fresh(codeConfirmedRaw) ? codeConfirmedRaw : null;
  const tokenConfirmedAt = fresh(tokenConfirmedRaw) ? tokenConfirmedRaw : null;

  if (codeConfirmedAt && (!tokenConfirmedAt || codeConfirmedAt >= tokenConfirmedAt)) {
    return { kind: 'confirmed', source: 'mc', purpose: 'LOGIN' };
  }
  if (tokenConfirmedAt && token) {
    return { kind: 'confirmed', source: 'tg', purpose: token.purpose };
  }

  // 2. Живое ожидание. Приоритет у того, что запрошено позже.
  const codeAlive = code && code.status === 'PENDING' && code.expiresAt > now ? code : null;
  const tokenAlive = token && token.status === 'PENDING' && token.expiresAt > now ? token : null;

  if (codeAlive && tokenAlive) {
    return codeAlive.createdAt >= tokenAlive.createdAt
      ? { kind: 'pending', source: 'mc', expiresAt: codeAlive.expiresAt }
      : { kind: 'pending', source: 'tg', expiresAt: tokenAlive.expiresAt };
  }
  if (tokenAlive) return { kind: 'pending', source: 'tg', expiresAt: tokenAlive.expiresAt };
  if (codeAlive) return { kind: 'pending', source: 'mc', expiresAt: codeAlive.expiresAt };

  // 3. Живого ничего нет: сообщаем про то, что просили позже.
  if (code && token) {
    return { kind: 'expired', source: code.createdAt >= token.createdAt ? 'mc' : 'tg' };
  }
  if (token) return { kind: 'expired', source: 'tg' };
  if (code) return { kind: 'expired', source: 'mc' };

  return { kind: 'none' };
}

/**
 * Забирает подтверждённый вход и помечает его использованным.
 * Возвращает id пользователя, под которым надо создать сессию.
 */
export async function consumeConfirmedLogin(
  browserToken: string,
): Promise<{ userId: string; purpose: 'LOGIN' | 'LINK' }> {
  const [code, token] = await Promise.all([
    prisma.loginCode.findFirst({
      where: { browserToken, status: 'CONFIRMED' },
      orderBy: { confirmedAt: 'desc' },
    }),
    prisma.tgLoginToken.findFirst({
      where: { browserToken, status: 'CONFIRMED' },
      orderBy: { confirmedAt: 'desc' },
    }),
  ]);

  const codeAt = code?.confirmedAt ?? code?.createdAt ?? null;
  const tokenAt = token?.confirmedAt ?? token?.createdAt ?? null;
  const takeCode = Boolean(code?.userId) && (!tokenAt || (codeAt && codeAt >= tokenAt));

  if (takeCode && code?.userId) {
    await prisma.loginCode.update({ where: { id: code.id }, data: { status: 'USED' } });
    devLog('забрали подтверждение из игры', { browser: browserToken.slice(0, 8) });
    return { userId: code.userId, purpose: 'LOGIN' };
  }

  if (token) {
    await prisma.tgLoginToken.update({ where: { id: token.id }, data: { status: 'USED' } });
    devLog('забрали подтверждение из Telegram', {
      browser: browserToken.slice(0, 8),
      purpose: token.purpose,
    });

    if (token.purpose === 'LINK') {
      if (!token.targetUserId) throw badRequest('bad_token', 'Токен привязки испорчен');
      return { userId: token.targetUserId, purpose: 'LINK' };
    }
    if (!token.resultUserId) throw badRequest('bad_token', 'Токен входа испорчен');
    return { userId: token.resultUserId, purpose: 'LOGIN' };
  }

  throw notFound('Подтверждённого входа нет');
}

/** Чистка протухших кодов и токенов. Дёргается изредка при обращениях. */
export async function cleanupExpired() {
  const now = new Date();
  await prisma.$transaction([
    prisma.loginCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 3600_000) } } }),
    prisma.tgLoginToken.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - 3600_000) } },
    }),
  ]);
}
