import { AdminWiki, type AdminArticle } from './AdminWiki';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminWikiPage() {
  const rows = await prisma.wikiArticle.findMany({
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
  });

  const articles: AdminArticle[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    body: row.body,
    published: row.published,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <>
      <div className="section-title">
        <h2>Вики</h2>
      </div>
      <AdminWiki articles={articles} />
    </>
  );
}
