import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { playerPoints } from '@/server/points';
import { privateJson } from '../../_shared';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = handler(async (_request, context: Context) => {
  const actor = await requireAdmin();
  const { id } = await context.params;
  return privateJson(await playerPoints(actor, id));
});
