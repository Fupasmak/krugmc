import { handler, jsonOk, getClientIp } from '@/lib/http';
import { getOrCreateBrowserToken } from '@/lib/session';
import { createLoginCode, LOGIN_CODE_TTL_MS } from '@/server/login';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { assertCsrf } from '@/lib/csrf';
import { currentUser } from '@/lib/auth';
import { badRequest } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Шаг 1 входа через Minecraft: выдать одноразовый код. */
export const POST = handler(async (request) => {
  await assertCsrf(request);

  if (await currentUser()) throw badRequest('already_logged_in', 'Ты уже вошёл');

  const ip = getClientIp(request);
  await rateLimit({ key: `login-code:${ip ?? 'unknown'}`, ...LIMITS.loginCode });

  const browserToken = await getOrCreateBrowserToken();
  const code = await createLoginCode(browserToken, ip);

  return jsonOk({
    code: code.code,
    expiresAt: code.expiresAt.toISOString(),
    ttlSeconds: Math.round(LOGIN_CODE_TTL_MS / 1000),
    command: `/krug login ${code.code}`,
  });
});
