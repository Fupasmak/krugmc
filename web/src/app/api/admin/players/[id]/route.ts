import { z } from 'zod';
import { handler, jsonOk, badRequest, notFound } from '@/lib/http';
import { requireAdmin, requireSuperadmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  hidden: z.boolean().optional(),
  wikiText: z.string().max(20000).nullable().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
});

export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const input = patchSchema.parse(await request.json());
  const player = await prisma.user.findUnique({ where: { id } });
  if (!player || player.type !== 'MC') throw notFound('Игрок не найден');

  // Роли раздаёт только главный админ, и снять роль с него самого нельзя.
  if (input.role !== undefined) {
    await requireSuperadmin();
    if (player.role === 'SUPERADMIN') {
      throw badRequest('cannot_change_superadmin', 'Роль главного администратора не меняется');
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.hidden !== undefined ? { hidden: input.hidden } : {}),
      ...(input.wikiText !== undefined ? { wikiText: input.wikiText } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
    },
    select: { id: true, hidden: true, role: true, mcNickname: true },
  });

  await audit({
    actor,
    action: 'player.update',
    target: updated.mcNickname,
    meta: input as Record<string, unknown>,
  });

  return jsonOk({ player: updated });
});

/** Удалить можно только игрока, который ни разу не заходил и ничего не писал. */
export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const player = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      mcNickname: true,
      firstLoginAt: true,
      role: true,
      _count: { select: { posts: true } },
    },
  });
  if (!player || player.type !== 'MC') throw notFound('Игрок не найден');
  if (player.role === 'SUPERADMIN') throw badRequest('cannot_delete', 'Это главный администратор');
  if (player.firstLoginAt) {
    throw badRequest('player_active', 'Игрок уже заходил на сайт, его можно только скрыть');
  }
  if (player._count.posts > 0) {
    throw badRequest('player_has_posts', 'У игрока есть завозы, его можно только скрыть');
  }

  await prisma.user.delete({ where: { id } });
  await audit({ actor, action: 'player.delete', target: player.mcNickname });

  return jsonOk({ deleted: true });
});
