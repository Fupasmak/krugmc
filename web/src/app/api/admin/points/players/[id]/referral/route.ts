import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { pointsReferralSchema } from '@/lib/validation';
import { setReferral } from '@/server/points';
import { privateJson } from '../../../_shared';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;
  const input = pointsReferralSchema.parse(await request.json());
  await setReferral(actor, id, input.inviterUserId);
  return privateJson({ saved: true });
});
