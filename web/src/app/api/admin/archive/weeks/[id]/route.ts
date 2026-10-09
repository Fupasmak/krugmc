import { handler, jsonOk, notFound, badRequest } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { archiveWeekSchema } from '@/lib/validation';
import { deleteUpload } from '@/lib/uploads';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const input = archiveWeekSchema.partial().parse(await request.json());
  const week = await prisma.archiveWeek.findUnique({ where: { id } });
  if (!week) throw notFound('Неделя не найдена');

  if (input.number !== undefined && input.number !== week.number) {
    const clash = await prisma.archiveWeek.findUnique({ where: { number: input.number } });
    if (clash) throw badRequest('week_exists', `Неделя №${input.number} уже есть`);
  }

  const updated = await prisma.archiveWeek.update({
    where: { id },
    data: {
      ...(input.number !== undefined ? { number: input.number } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    },
  });

  await audit({ actor, action: 'archive.week.update', target: `#${updated.number}` });
  return jsonOk({ week: { id: updated.id, number: updated.number } });
});

export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const week = await prisma.archiveWeek.findUnique({
    where: { id },
    include: { items: { select: { path: true } } },
  });
  if (!week) throw notFound('Неделя не найдена');

  // Файлы пунктов недели удаляем вместе с записями.
  for (const item of week.items) {
    if (item.path) await deleteUpload(item.path);
  }
  if (week.coverPath) await deleteUpload(week.coverPath);

  await prisma.archiveWeek.delete({ where: { id } });
  await audit({ actor, action: 'archive.week.delete', target: `#${week.number}` });

  return jsonOk({ deleted: true });
});
