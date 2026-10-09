import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { pointsSeasonSchema } from '@/lib/validation';
import { seasonState, startSeason } from '@/server/points';
import { privateJson } from '../_shared';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const actor = await requireAdmin();
  return privateJson(await seasonState(actor));
});

export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const input = pointsSeasonSchema.parse(await request.json());
  const season = await startSeason(actor, input.title);
  return privateJson({ season: { id: season.id, title: season.title } });
});
