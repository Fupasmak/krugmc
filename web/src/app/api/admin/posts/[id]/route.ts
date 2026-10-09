import { z } from 'zod';
import { handler, jsonOk, notFound } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  pinned: z.boolean().optional(),
  restore: z.boolean().optional(),
});

/** Закрепление завоза и возврат удалённого. Обычное удаление, в /api/posts/[id]. */
export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const input = patchSchema.parse(await request.json());
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!post) throw notFound('Завоз не найден');

  const updated = await prisma.post.update({
    where: { id },
    data: {
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.restore ? { deletedAt: null } : {}),
    },
    select: { id: true, pinned: true, deletedAt: true },
  });

  await audit({ actor, action: 'post.admin.update', target: post.title, meta: input });
  return jsonOk({ post: updated });
});
