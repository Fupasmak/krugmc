import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { journal } from '@/server/points';
import { journalFilters, privateJson } from '../_shared';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const actor = await requireAdmin();
  return privateJson(await journal(actor, journalFilters(new URL(request.url))));
});
