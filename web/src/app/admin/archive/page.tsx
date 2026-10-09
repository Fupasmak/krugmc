import { AdminArchive, type AdminWeek } from './AdminArchive';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminArchivePage() {
  const rows = await prisma.archiveWeek.findMany({
    orderBy: { number: 'desc' },
    include: { items: { orderBy: { order: 'asc' } } },
  });

  const weeks: AdminWeek[] = rows.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    summary: row.summary,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    published: row.published,
    items: row.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      hasFile: Boolean(item.path),
      url: item.url,
    })),
  }));

  return (
    <>
      <div className="section-title">
        <h2>Архив</h2>
      </div>
      <AdminArchive weeks={weeks} />
    </>
  );
}
