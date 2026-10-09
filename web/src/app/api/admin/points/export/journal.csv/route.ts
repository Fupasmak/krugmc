import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { journalCsv } from '@/server/points';
import { csvResponse, journalFilters } from '../../_shared';

export const dynamic = 'force-dynamic';

export const GET = handler(async (request) => {
  const actor = await requireAdmin();
  const filters = journalFilters(new URL(request.url));
  return csvResponse(await journalCsv(actor, filters), 'krug-points-journal.csv');
});
