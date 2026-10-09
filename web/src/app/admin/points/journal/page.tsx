import type { PointCategory } from '@prisma/client';
import { currentUser } from '@/lib/auth';
import { POINT_CATEGORIES } from '@/lib/points';
import { journal, pointsOverview } from '@/server/points';
import { JournalView } from './JournalView';

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string; player?: string; category?: string; week?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentUser();
  const category = POINT_CATEGORIES.includes(params.category as PointCategory)
    ? (params.category as PointCategory)
    : null;

  const [data, overview] = await Promise.all([
    journal(actor, {
      actorId: params.admin ?? null,
      userId: params.player ?? null,
      category,
      weekId: params.week ?? null,
    }),
    pointsOverview(actor, {}),
  ]);

  return (
    <JournalView
      entries={data.entries}
      admins={data.admins}
      players={overview.rows.map((row) => ({ id: row.userId, nickname: row.nickname }))}
      weeks={overview.weeks.map((week) => ({ id: week.id, number: week.number }))}
      filters={{
        admin: params.admin ?? '',
        player: params.player ?? '',
        category: category ?? '',
        week: params.week ?? '',
      }}
    />
  );
}
