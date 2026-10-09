import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { pointsAwardSchema } from '@/lib/validation';
import { planAward } from '@/server/points';
import { privateJson } from '../../_shared';

export const dynamic = 'force-dynamic';

export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const input = pointsAwardSchema.parse(await request.json());
  const plan = await planAward(actor, input);
  return privateJson({
    weekNumber: plan.weekNumber,
    kind: plan.kind,
    presetTitle: plan.presetTitle,
    oncePerSeason: plan.oncePerSeason,
    onceUsed: plan.onceUsed,
    recipients: plan.recipients,
  });
});
