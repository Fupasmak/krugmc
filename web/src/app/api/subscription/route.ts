import { handler, jsonOk } from '@/lib/http';
import { currentUser } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { checkSubscription } from '@/lib/subscription';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Текущий статус подписки (из кэша, если он свежий). */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user?.tgId) {
    return jsonOk({ linked: false, subscribed: false, channel: env.TG_CHANNEL });
  }
  const result = await checkSubscription(user.tgId);
  return jsonOk({
    linked: true,
    subscribed: result.subscribed,
    fromCache: result.fromCache,
    botAvailable: result.botAvailable,
    channel: env.TG_CHANNEL,
  });
});

/** Кнопка «Я подписался, проверить»: спрашиваем у бота заново. */
export const POST = handler(async (request) => {
  await assertCsrf(request);
  const user = await currentUser();
  if (!user?.tgId) {
    return jsonOk({ linked: false, subscribed: false, channel: env.TG_CHANNEL });
  }

  await rateLimit({ key: `subcheck:${user.id}`, ...LIMITS.subscriptionCheck });

  const result = await checkSubscription(user.tgId, { force: true });
  return jsonOk({
    linked: true,
    subscribed: result.subscribed,
    botAvailable: result.botAvailable,
    channel: env.TG_CHANNEL,
  });
});
