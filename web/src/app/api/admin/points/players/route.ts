import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { pointsOverview } from '@/server/points';
import { privateJson } from '../_shared';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const actor = await requireAdmin();
  const week = new URL(request.url).searchParams.get('week');
  return privateJson(await pointsOverview(actor, { weekId: week }));
});
