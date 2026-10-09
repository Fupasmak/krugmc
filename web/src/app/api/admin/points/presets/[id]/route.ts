import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { pointsPresetSchema } from '@/lib/validation';
import { updatePreset } from '@/server/points';
import { privateJson } from '../../_shared';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;
  const input = pointsPresetSchema.parse(await request.json());
  return privateJson({ preset: await updatePreset(actor, id, input) });
});
