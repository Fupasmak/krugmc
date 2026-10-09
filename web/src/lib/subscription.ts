import 'server-only';
import { prisma } from './prisma';
import { env } from './env';
import { signHeaders } from './hmac';

/**
 * Проверка подписки на канал. Токен бота живёт только в боте, поэтому сайт
 * спрашивает у бота по внутреннему адресу, а бот дёргает getChatMember.
 * Результат кэшируется на SUBSCRIPTION_CACHE_TTL секунд.
 */

export type SubscriptionResult = {
  subscribed: boolean;
  fromCache: boolean;
  botAvailable: boolean;
};

export async function checkSubscription(
  tgId: bigint,
  options: { force?: boolean } = {},
): Promise<SubscriptionResult> {
  if (!options.force) {
    const cached = await prisma.subscriptionCache.findUnique({ where: { tgId } });
    const ttlMs = env.SUBSCRIPTION_CACHE_TTL * 1000;
    if (cached && Date.now() - cached.checkedAt.getTime() < ttlMs) {
      return { subscribed: cached.subscribed, fromCache: true, botAvailable: true };
    }
  }

  const body = JSON.stringify({ tgId: tgId.toString() });
  let subscribed: boolean | null = null;

  try {
    const response = await fetch(`${env.BOT_INTERNAL_URL}/internal/subscription`, {
      method: 'POST',
      headers: signHeaders(env.INTERNAL_API_SECRET, body),
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const data = (await response.json()) as { ok?: boolean; subscribed?: boolean };
      if (data.ok && typeof data.subscribed === 'boolean') subscribed = data.subscribed;
    }
  } catch {
    subscribed = null;
  }

  if (subscribed === null) {
    // Бот недоступен: отдаём последний известный ответ, но помечаем это.
    const cached = await prisma.subscriptionCache.findUnique({ where: { tgId } });
    return {
      subscribed: cached?.subscribed ?? false,
      fromCache: true,
      botAvailable: false,
    };
  }

  await prisma.subscriptionCache.upsert({
    where: { tgId },
    create: { tgId, subscribed, checkedAt: new Date() },
    update: { subscribed, checkedAt: new Date() },
  });

  return { subscribed, fromCache: false, botAvailable: true };
}
