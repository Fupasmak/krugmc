import { z } from 'zod';
import { handler, jsonOk, notFound } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { deleteUpload } from '@/lib/uploads';
import { audit, findPlayerByNickname } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(4000).nullable().optional(),
  kind: z.enum(['BUILD', 'ART', 'VIDEO', 'POST', 'LIFE']).optional(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
  authorNickname: z.string().max(16).nullable().optional(),
});

export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const input = patchSchema.parse(await request.json());
  const item = await prisma.archiveItem.findUnique({ where: { id } });
  if (!item) throw notFound('Пункт архива не найден');

  let authorId = item.authorId;
  if (input.authorNickname !== undefined) {
    authorId = input.authorNickname ? (await findPlayerByNickname(input.authorNickname)).id : null;
  }

  const updated = await prisma.archiveItem.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      authorId,
    },
  });

  await audit({ actor, action: 'archive.item.update', target: updated.title });
  return jsonOk({ item: { id: updated.id } });
});

export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const item = await prisma.archiveItem.findUnique({ where: { id } });
  if (!item) throw notFound('Пункт архива не найден');

  if (item.path) await deleteUpload(item.path);
  await prisma.archiveItem.delete({ where: { id } });
  await audit({ actor, action: 'archive.item.delete', target: item.title });

  return jsonOk({ deleted: true });
});
