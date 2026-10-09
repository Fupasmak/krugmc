import 'server-only';
import { prisma } from './prisma';
import { tooMany } from './http';

/**
 * Счётчик в базе, а не в памяти процесса: при нескольких воркерах Next
 * память у каждого своя, и лимит легко обойти.
 */
export async function rateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
  message: string;
}) {
  const { key, limit, windowSeconds, message } = options;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  const row = await prisma.rateLimit.findUnique({ where: { key } });

  if (!row || row.windowStart < windowStart) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return;
  }

  if (row.count >= limit) {
    const waitSeconds = Math.ceil(
      (row.windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000,
    );
    throw tooMany(`${message} Попробуй через ${formatWait(waitSeconds)}.`);
  }

  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.max(seconds, 1)} сек`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.ceil(minutes / 60)} ч`;
}

/** Лимиты в одном месте, чтобы не искать их по коду. */
export const LIMITS = {
  loginCode: { limit: 10, windowSeconds: 3600, message: 'Кодов уже многовато.' },
  loginAttempt: { limit: 20, windowSeconds: 3600, message: 'Слишком много попыток входа подряд.' },
  vote: { limit: 30, windowSeconds: 3600, message: 'Голосов за час хватит, дай другим.' },
  createPost: { limit: 5, windowSeconds: 3600, message: 'Завозы идут слишком плотно.' },
  editPost: { limit: 20, windowSeconds: 3600, message: 'Правок многовато.' },
  upload: { limit: 30, windowSeconds: 3600, message: 'Загрузок за час уже достаточно.' },
  subscriptionCheck: { limit: 20, windowSeconds: 600, message: 'Подписку проверяем не так часто.' },
} as const;
