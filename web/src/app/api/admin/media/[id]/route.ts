import { handler, jsonOk, notFound } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const item = await prisma.mediaItem.findUnique({ where: { id } });
  if (!item) throw notFound('Видео не найдено');

  await prisma.mediaItem.delete({ where: { id } });
  await audit({ actor, action: 'media.delete', target: item.title });

  return jsonOk({ deleted: true });
});
