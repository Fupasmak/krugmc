import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { closeSeason } from '@/server/points';
import { privateJson } from '../../../_shared';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const POST = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;
  return privateJson(await closeSeason(actor, id));
});
