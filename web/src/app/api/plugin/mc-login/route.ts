import { NextResponse } from 'next/server';
import { handler, jsonError } from '@/lib/http';
import { verifySignedRequest } from '@/lib/hmac';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { mcConfirmSchema } from '@/lib/validation';
import { upsertMinecraftUser } from '@/server/users';
import { MAX_CODE_ATTEMPTS } from '@/server/login';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Плагин подтверждает вход: игрок написал в игре /krug login КОД.
 * Запрос подписан HMAC, формат описан в API.md.
 */
export const POST = handler(async (request) => {
  const verified = await verifySignedRequest(request, env.MC_HMAC_SECRET, 'mc');
  if (!verified.ok) {
    return NextResponse.json(
      { ok: false, error: verified.error, message: 'Подпись запроса не принята' },
      { status: verified.status },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(verified.body);
  } catch {
    return jsonError(new Error('bad_json'));
  }

  const data = mcConfirmSchema.parse(payload);

  await rateLimit({ key: `mc-confirm:${data.uuid}`, ...LIMITS.loginAttempt });

  const code = await prisma.loginCode.findUnique({ where: { code: data.code } });

  if (!code || code.status !== 'PENDING') {
    return NextResponse.json(
      { ok: false, error: 'code_not_found', message: 'Код не найден или уже использован' },
      { status: 404 },
    );
  }

  if (code.expiresAt < new Date()) {
    await prisma.loginCode.update({ where: { id: code.id }, data: { status: 'EXPIRED' } });
    return NextResponse.json(
      { ok: false, error: 'code_expired', message: 'Код протух. Возьми новый на сайте' },
      { status: 410 },
    );
  }

  if (code.attempts >= MAX_CODE_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: 'too_many_attempts', message: 'Слишком много попыток по этому коду. Выдохни' },
      { status: 429 },
    );
  }

  await prisma.loginCode.update({
    where: { id: code.id },
    data: { attempts: { increment: 1 } },
  });

  const user = await upsertMinecraftUser({
    uuid: data.uuid,
    nickname: data.nickname,
    textures: data.textures ?? null,
  });

  const claimed = await prisma.loginCode.updateMany({
    where: { id: code.id, status: 'PENDING' },
    data: { status: 'CONFIRMED', userId: user.id, confirmedAt: new Date() },
  });
  if (claimed.count !== 1) {
    return NextResponse.json(
      { ok: false, error: 'code_not_found', message: 'Код уже использован' },
      { status: 409 },
    );
  }

  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'login.minecraft', target: user.mcNickname ?? user.id },
  });

  return NextResponse.json({
    ok: true,
    message: 'Вход подтверждён. Возвращайся на сайт, ты в круге',
    nickname: user.mcNickname,
    profileUrl: `${env.SITE_URL}/players/${user.mcNicknameLower}`,
  });
});
