import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { pointsAwardSchema } from '@/lib/validation';
import { award } from '@/server/points';
import { privateJson } from '../_shared';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const input = pointsAwardSchema.parse(await request.json());
  return privateJson(await award(actor, input));
});
