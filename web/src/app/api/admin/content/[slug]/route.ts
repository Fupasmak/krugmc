import { handler, jsonOk, badRequest } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { contentSchema } from '@/lib/validation';
import { CONTENT_PAGES, isContentSlug, readContent, resetContent, writeContent } from '@/lib/content';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

export const GET = handler(async (_request, context: Context) => {
  await requireAdmin();
  const { slug } = await context.params;
  if (!isContentSlug(slug)) throw badRequest('bad_slug', 'Такой страницы нет');

  return jsonOk({ slug, title: CONTENT_PAGES[slug].title, body: await readContent(slug) });
});

/** Правка текста страницы. Версия из базы перекрывает файл в web/content. */
export const PUT = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { slug } = await context.params;
  if (!isContentSlug(slug)) throw badRequest('bad_slug', 'Такой страницы нет');

  const { body } = contentSchema.parse(await request.json());
  await writeContent(slug, body);
  await audit({ actor, action: 'content.update', target: slug });

  return jsonOk({ slug, saved: true });
});

/** Вернуть текст к исходному файлу. */
export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { slug } = await context.params;
  if (!isContentSlug(slug)) throw badRequest('bad_slug', 'Такой страницы нет');

  await resetContent(slug);
  await audit({ actor, action: 'content.reset', target: slug });

  return jsonOk({ slug, body: await readContent(slug) });
});
