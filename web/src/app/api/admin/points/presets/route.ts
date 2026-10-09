import { handler } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { pointsPresetSchema } from '@/lib/validation';
import { createPreset, listPresets } from '@/server/points';
import { privateJson } from '../_shared';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const actor = await requireAdmin();
  return privateJson({ presets: await listPresets(actor) });
});

export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const input = pointsPresetSchema.parse(await request.json());
  return privateJson({ preset: await createPreset(actor, input) });
});
