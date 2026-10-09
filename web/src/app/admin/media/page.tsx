import { AdminMedia, type AdminMediaItem } from './AdminMedia';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  const rows = await prisma.mediaItem.findMany({
    orderBy: { publishedAt: 'desc' },
    include: { author: { select: { mcNickname: true } }, week: { select: { number: true } } },
    take: 300,
  });

  const items: AdminMediaItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    author: row.author?.mcNickname ?? null,
    week: row.week?.number ?? null,
    publishedAt: row.publishedAt.toISOString(),
  }));

  return (
    <>
      <div className="section-title">
        <h2>Медиа</h2>
      </div>
      <AdminMedia items={items} />
    </>
  );
}
