import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { playersCsv } from '@/server/points';
import { csvResponse } from '../../_shared';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const actor = await requireAdmin();
  const week = new URL(request.url).searchParams.get('week');
  return csvResponse(await playersCsv(actor, week), 'krug-points-players.csv');
});
