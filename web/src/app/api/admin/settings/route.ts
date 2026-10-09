import { handler, jsonOk, badRequest } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { settingsSchema } from '@/lib/validation';
import { getSettings, saveSettings } from '@/lib/settings';
import { audit } from '@/server/admin';
import { isSupportedVideoUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdmin();
  return jsonOk({ settings: await getSettings() });
});

/** Статус проекта, трейлер, слоган. */
export const PATCH = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const input = settingsSchema.parse(await request.json());
  if (input.trailerUrl && input.trailerUrl.trim() && !isSupportedVideoUrl(input.trailerUrl)) {
    throw badRequest('bad_video_url', 'Трейлер: ссылка на YouTube или VK');
  }

  // Карта встраивается в iframe, поэтому пускаем только https
  if (input.mapUrl && input.mapUrl.trim()) {
    try {
      const parsed = new URL(input.mapUrl.trim());
      if (parsed.protocol !== 'https:') throw new Error('not https');
    } catch {
      throw badRequest('bad_map_url', 'Ссылка на карту должна начинаться с https://');
    }
  }

  const settings = await saveSettings(input);
  // Адрес сервера в журнал не пишем: журнал читают все админы, а адрес нигде не светится
  const { serverAddress, ...logged } = input;
  await audit({
    actor,
    action: 'settings.update',
    meta: { ...logged, ...(serverAddress === undefined ? {} : { serverAddress: 'изменён' }) },
  });

  return jsonOk({ settings });
});
