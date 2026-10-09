import { handler, jsonOk, forbidden, badRequest } from '@/lib/http';
import { requireViewer } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { voteInputSchema } from '@/lib/validation';
import { castVote } from '@/server/posts';
import { checkSubscription } from '@/lib/subscription';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Голос за завоз.
 * Условия: вошёл через Telegram и подписан на канал. Голос неизменяемый.
 */
export const POST = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const user = await requireViewer();
  const { id } = await context.params;

  await rateLimit({ key: `vote:${user.id}`, ...LIMITS.vote });

  if (!user.tgId) throw forbidden('К аккаунту не привязан Telegram');

  const subscription = await checkSubscription(user.tgId);
  if (!subscription.botAvailable && !subscription.subscribed) {
    throw badRequest(
      'bot_unavailable',
      'Бот прилёг отдохнуть, подписку проверить не вышло. Попробуй чуть позже',
    );
  }
  if (!subscription.subscribed) {
    throw forbidden(`Голосуют свои. Подпишись на ${env.TG_CHANNEL} и возвращайся круглым`);
  }

  const { value } = voteInputSchema.parse(await request.json());
  const result = await castVote({ postId: id, user, value });

  return jsonOk(result);
});
