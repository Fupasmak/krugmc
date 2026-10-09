import fsp from 'node:fs/promises';
import path from 'node:path';
import { handler, jsonOk, badRequest, notFound } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { parseUpload, deleteUpload, uploadAbsolutePath, saveCardPng } from '@/lib/uploads';
import { audit } from '@/server/admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Загрузка PNG-карточки игрока. Картинка приводится к 800x1200 (2:3). */
export const POST = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const player = await prisma.user.findUnique({ where: { id } });
  if (!player || player.type !== 'MC' || !player.mcNicknameLower) throw notFound('Игрок не найден');

  const { files } = await parseUpload(request, { maxFiles: 1, allowVideo: false });
  const file = files[0];
  if (!file) throw badRequest('no_file', 'Файл не приложен');

  try {
    const buffer = await fsp.readFile(uploadAbsolutePath(file.path));
    const fileName = await saveCardPng(player.mcNicknameLower, buffer);

    await prisma.user.update({ where: { id }, data: { cardFile: fileName } });
    await audit({ actor, action: 'player.card.upload', target: player.mcNickname });

    return jsonOk({ cardFile: fileName, url: `/cards/${fileName}` });
  } finally {
    // Исходник во временной папке загрузок больше не нужен.
    await deleteUpload(file.path);
  }
});

export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const actor = await requireAdmin();
  const { id } = await context.params;

  const player = await prisma.user.findUnique({ where: { id } });
  if (!player) throw notFound('Игрок не найден');
  if (!player.cardFile) throw badRequest('no_card', 'Карточки и так нет');

  const target = path.resolve(process.cwd(), 'public', 'cards', path.basename(player.cardFile));
  await fsp.rm(target, { force: true });
  await prisma.user.update({ where: { id }, data: { cardFile: null } });
  await audit({ actor, action: 'player.card.delete', target: player.mcNickname });

  return jsonOk({ deleted: true });
});
