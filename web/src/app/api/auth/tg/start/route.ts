import { handler, jsonOk, getClientIp, badRequest } from '@/lib/http';
import { getOrCreateBrowserToken } from '@/lib/session';
import { createTgToken, TG_TOKEN_TTL_MS } from '@/server/login';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { assertCsrf } from '@/lib/csrf';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Шаг 1 входа через Telegram: выдать токен и ссылку на бота.
 * Тот же роут выдаёт ссылку привязки, если игрок уже вошёл.
 */
export const POST = handler(async (request) => {
  await assertCsrf(request);

  const ip = getClientIp(request);
  await rateLimit({ key: `tg-token:${ip ?? 'unknown'}`, ...LIMITS.loginCode });

  if (await currentUser()) throw badRequest('already_logged_in', 'Ты уже вошёл');

  const browserToken = await getOrCreateBrowserToken();

  const token = await createTgToken({ browserToken, purpose: 'LOGIN', ip });
  return jsonOk({
    purpose: 'LOGIN',
    deepLink: `https://t.me/${env.TG_BOT_USERNAME}?start=login_${token.token}`,
    expiresAt: token.expiresAt.toISOString(),
    ttlSeconds: Math.round(TG_TOKEN_TTL_MS / 1000),
  });
});
