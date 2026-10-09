import { NextResponse } from 'next/server';
import { handler, jsonError } from '@/lib/http';
import { verifySignedRequest } from '@/lib/hmac';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { tgConfirmSchema } from '@/lib/validation';
import { upsertTelegramUser } from '@/server/users';

export const dynamic = 'force-dynamic';

const devLog = (message: string, data?: Record<string, unknown>) => {
  if (process.env.NODE_ENV !== 'development') return;
  console.log(`[tg-confirm] ${message}`, data ?? '');
};

/**
 * Бот подтверждает действие по deep-link: вход зрителя или привязку
 * Telegram к аккаунту игрока. Запрос подписан HMAC (INTERNAL_API_SECRET).
 *
 * Причины отказа различаются: token_not_found, token_expired,
 * token_already_used, bad_signature. Складывать их в одно «протух» нельзя,
 * иначе непонятно, что чинить.
 */
export const POST = handler(async (request) => {
  const verified = await verifySignedRequest(request, env.INTERNAL_API_SECRET, 'bot');
  if (!verified.ok) {
    devLog('подпись не принята', { error: verified.error });
    return NextResponse.json(
      {
        ok: false,
        error: verified.error === 'bad_signature' ? 'bad_signature' : verified.error,
        message: 'Подпись запроса не принята. Проверь INTERNAL_API_SECRET у сайта и бота',
      },
      { status: verified.status },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(verified.body);
  } catch {
    return jsonError(new Error('bad_json'));
  }

  const data = tgConfirmSchema.parse(payload);
  const tgId = BigInt(data.tgId);

  const token = await prisma.tgLoginToken.findUnique({ where: { token: data.token } });

  devLog('пришёл токен от бота', {
    token: `${data.token.slice(0, 8)}...`,
    length: data.token.length,
    tgId: data.tgId,
    found: Boolean(token),
    status: token?.status ?? null,
    expiresUtc: token?.expiresAt.toISOString() ?? null,
    nowUtc: new Date().toISOString(),
  });

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error: 'token_not_found',
        message: 'Такой ссылки не знаю. Начни вход заново на сайте',
      },
      { status: 404 },
    );
  }

  if (token.status === 'USED' || token.status === 'CONFIRMED') {
    return NextResponse.json(
      {
        ok: false,
        error: 'token_already_used',
        message: 'Эта ссылка уже отработала своё. Нажми «Войти» на сайте ещё раз',
      },
      { status: 409 },
    );
  }

  if (token.expiresAt < new Date()) {
    await prisma.tgLoginToken.update({ where: { id: token.id }, data: { status: 'EXPIRED' } });
    return NextResponse.json(
      {
        ok: false,
        error: 'token_expired',
        message: 'Код протух. Возьми новый на сайте и попробуй снова',
      },
      { status: 410 },
    );
  }

  const user = await upsertTelegramUser({
    tgId,
    username: data.username ?? null,
    firstName: data.firstName ?? null,
    photoUrl: data.photoUrl ?? null,
  });

  await prisma.tgLoginToken.update({
    where: { id: token.id },
    data: { status: 'CONFIRMED', confirmedAt: new Date(), resultUserId: user.id },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'login.telegram', target: data.tgId },
  });

  devLog('вход подтверждён', { userId: user.id, browser: token.browserToken.slice(0, 8) });

  return NextResponse.json({ ok: true, purpose: 'LOGIN', message: 'Вход подтверждён' });
});
