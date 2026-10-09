import { handler, jsonOk, badRequest } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { archiveWeekSchema } from '@/lib/validation';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdmin();
  const weeks = await prisma.archiveWeek.findMany({
    orderBy: { number: 'desc' },
    include: { _count: { select: { items: true } } },
  });
  return jsonOk({
    weeks: weeks.map((week) => ({
      id: week.id,
      number: week.number,
      title: week.title,
      summary: week.summary,
      published: week.published,
      startsAt: week.startsAt.toISOString(),
      endsAt: week.endsAt.toISOString(),
      items: week._count.items,
    })),
  });
});

export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const input = archiveWeekSchema.parse(await request.json());
  if (input.endsAt < input.startsAt) {
    throw badRequest('bad_dates', 'Конец недели раньше начала');
  }

  const exists = await prisma.archiveWeek.findUnique({ where: { number: input.number } });
  if (exists) throw badRequest('week_exists', `Неделя №${input.number} уже есть`);

  const week = await prisma.archiveWeek.create({
    data: {
      number: input.number,
      title: input.title,
      summary: input.summary ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      published: input.published ?? false,
    },
  });

  await audit({ actor, action: 'archive.week.create', target: `#${week.number}` });
  return jsonOk({ week: { id: week.id, number: week.number } }, { status: 201 });
});
