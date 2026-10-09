import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentPage } from '@/components/ContentPage';
import { currentUser, isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { plainExcerpt } from '@/lib/markdown';
import { getTexts } from '@/server/texts';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.wikiArticle.findUnique({ where: { slug } });
  if (!article) return { title: (await getTexts())['wiki.notFound'] };

  return {
    title: article.title,
    description: plainExcerpt(article.body, 160),
    robots: article.published ? undefined : { index: false },
  };
}

export default async function WikiArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [viewer, texts] = await Promise.all([currentUser(), getTexts()]);
  const staff = isAdmin(viewer);

  const article = await prisma.wikiArticle.findUnique({ where: { slug } });
  if (!article || (!article.published && !staff)) notFound();

  return (
    <ContentPage
      title={article.title}
      markdown={article.body}
      intro={
        <p className="faint">
          <Link href="/wiki">{texts['wiki.title']}</Link> · {article.category}
          {!article.published && ` · ${texts['wiki.draft']}`}
        </p>
      }
    />
  );
}
