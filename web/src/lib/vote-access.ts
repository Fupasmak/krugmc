import type { User } from '@prisma/client';
import type { VoteAccess } from '@/components/VoteButtons';

/**
 * Кто может голосовать: только зрители, вошедшие через Telegram.
 * Игроки сервера оценку не ставят, автор за себя: тоже.
 */
export function voteAccess(viewer: User | null, authorId: string): VoteAccess {
  if (!viewer) return 'guest';
  if (viewer.id === authorId) return 'author';
  if (viewer.type !== 'TG') return 'player';
  return 'viewer';
}
