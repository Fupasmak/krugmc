import { handler, jsonOk } from '@/lib/http';
import { destroyAllSessions } from '@/lib/session';
import { assertCsrf } from '@/lib/csrf';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Выйти на всех устройствах: гасим все сессии этого аккаунта. */
export const POST = handler(async (request) => {
  await assertCsrf(request);
  const user = await requireUser();
  await destroyAllSessions(user.id);
  return jsonOk({ redirect: '/' });
});
