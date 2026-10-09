import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { currentUser, isAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { getTexts } from '@/server/texts';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['wiki.title'], description: texts['wiki.description'] };
}

export const dynamic = 'force-dynamic';

export default async function WikiPage() {
  const [viewer, texts] = await Promise.all([currentUser(), getTexts()]);
  const staff = isAdmin(viewer);

  const articles = await prisma.wikiArticle.findMany({
    where: staff ? {} : { published: true },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
  });

  const categories = [...new Set(articles.map((article) => article.category))];

  return (
    <div className="container page">
      <div className="section-title">
        <h1>{texts['wiki.title']}</h1>
        {staff && (
          <Link href="/admin/wiki" className="btn btn--gold btn--sm">
            {texts['wiki.edit']}
          </Link>
        )}
      </div>

      {articles.length === 0 ? (
        <div className="panel">{texts['wiki.empty']}</div>
      ) : (
        categories.map((category) => (
          <section key={category} style={{ marginBottom: 'var(--gap-lg)' }}>
            <div className="section-title">
              <h2>{category}</h2>
            </div>
            <ul>
              {articles
                .filter((article) => article.category === category)
                .map((article) => (
                  <li key={article.id}>
                    <Link href={`/wiki/${article.slug}`}>{article.title}</Link>{' '}
                    <span className="faint">· {texts['wiki.updated']} {formatDate(article.updatedAt)}</span>
                    {!article.published && <span className="tag">{texts['wiki.draft']}</span>}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
