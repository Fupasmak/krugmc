import { handler, jsonOk, badRequest } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { wikiArticleSchema } from '@/lib/validation';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdmin();
  const articles = await prisma.wikiArticle.findMany({
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
    select: { id: true, slug: true, title: true, category: true, published: true, updatedAt: true },
  });
  return jsonOk({
    articles: articles.map((article) => ({
      ...article,
      updatedAt: article.updatedAt.toISOString(),
    })),
  });
});

export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const input = wikiArticleSchema.parse(await request.json());
  const exists = await prisma.wikiArticle.findUnique({ where: { slug: input.slug } });
  if (exists) throw badRequest('slug_taken', 'Статья с таким адресом уже есть');

  const article = await prisma.wikiArticle.create({
    data: {
      slug: input.slug,
      title: input.title,
      category: input.category,
      body: input.body,
      published: input.published ?? true,
      updatedById: actor.id,
    },
  });

  await audit({ actor, action: 'wiki.create', target: article.slug });
  return jsonOk({ article: { id: article.id, slug: article.slug } }, { status: 201 });
});
