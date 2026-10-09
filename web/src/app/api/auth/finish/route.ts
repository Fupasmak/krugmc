import { handler, jsonOk, getClientIp, badRequest } from '@/lib/http';
import { createSession, readBrowserToken } from '@/lib/session';
import { consumeConfirmedLogin } from '@/server/login';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Шаг 2 любого входа: подтверждение уже есть в базе, создаём сессию.
 * Для привязки Telegram сессия не нужна, она уже есть.
 */
export const POST = handler(async (request) => {
  await assertCsrf(request);

  const ip = getClientIp(request);
  await rateLimit({ key: `login-finish:${ip ?? 'unknown'}`, ...LIMITS.loginAttempt });

  const browserToken = await readBrowserToken();
  if (!browserToken) throw badRequest('no_browser_token', 'Cookie браузера потерялась, обнови страницу');

  const { userId } = await consumeConfirmedLogin(browserToken);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw badRequest('user_missing', 'Аккаунт не найден');

  await createSession(user.id, ip, request.headers.get('user-agent'));

  return jsonOk({
    redirect: user.type === 'MC' ? '/me' : '/posts',
    user: {
      id: user.id,
      type: user.type,
      role: user.role,
      nickname: user.mcNickname,
      tgUsername: user.tgUsername,
    },
  });
});
