import { handler, jsonOk, notFound, badRequest } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { wikiArticleSchema } from '@/lib/validation';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const input = wikiArticleSchema.partial().parse(await request.json());
  const article = await prisma.wikiArticle.findUnique({ where: { id } });
  if (!article) throw notFound('Статья не найдена');

  if (input.slug && input.slug !== article.slug) {
    const clash = await prisma.wikiArticle.findUnique({ where: { slug: input.slug } });
    if (clash) throw badRequest('slug_taken', 'Статья с таким адресом уже есть');
  }

  const updated = await prisma.wikiArticle.update({
    where: { id },
    data: {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
      updatedById: actor.id,
    },
  });

  await audit({ actor, action: 'wiki.update', target: updated.slug });
  return jsonOk({ article: { id: updated.id, slug: updated.slug } });
});

export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const article = await prisma.wikiArticle.findUnique({ where: { id } });
  if (!article) throw notFound('Статья не найдена');

  await prisma.wikiArticle.delete({ where: { id } });
  await audit({ actor, action: 'wiki.delete', target: article.slug });

  return jsonOk({ deleted: true });
});
