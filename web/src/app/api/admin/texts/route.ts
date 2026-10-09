import { z } from 'zod';
import { handler, jsonOk } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { getTexts, resetText, saveTexts } from '@/server/texts';
import { TEXT_KEYS, type TextKey } from '@/lib/site-texts';
import { audit } from '@/server/admin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  texts: z.record(z.string(), z.string().max(2000)),
});

const resetSchema = z.object({ key: z.string() });

export const GET = handler(async () => {
  await requireAdmin();
  return jsonOk({ texts: await getTexts() });
});

export const PUT = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const { texts } = patchSchema.parse(await request.json());
  const known = Object.fromEntries(
    Object.entries(texts).filter(([key]) => (TEXT_KEYS as string[]).includes(key)),
  ) as Partial<Record<TextKey, string>>;

  await saveTexts(known, actor.id);
  await audit({ actor, action: 'texts.update', meta: { keys: Object.keys(known) } });

  // страницы отдаются динамически, но сбрасываем кэш на всякий случай
  revalidatePath('/', 'layout');

  return jsonOk({ texts: await getTexts() });
});

export const DELETE = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const { key } = resetSchema.parse(await request.json());
  if (!(TEXT_KEYS as string[]).includes(key)) return jsonOk({ texts: await getTexts() });

  await resetText(key as TextKey);
  await audit({ actor, action: 'texts.reset', target: key });
  revalidatePath('/', 'layout');

  return jsonOk({ texts: await getTexts() });
});
