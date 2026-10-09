import { handler, jsonOk } from '@/lib/http';
import { destroyCurrentSession } from '@/lib/session';
import { assertCsrf } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  await assertCsrf(request);
  await destroyCurrentSession();
  return jsonOk({ redirect: '/' });
});
