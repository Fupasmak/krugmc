import { z } from 'zod';
import { handler, jsonOk, notFound } from '@/lib/http';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const schema = z.object({
  attachmentId: z.string().min(1),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
});

/**
 * Дозаполнение размеров вложения.
 *
 * У старых файлов ширины и высоты в базе нет: у видео их неоткуда было
 * взять при загрузке. Браузер знает размеры после чтения метаданных и
 * присылает их сюда, чтобы дальше вёрстка не прыгала.
 * Записываем только в пустые поля, перезаписать чужие значения нельзя.
 */
export const POST = handler(async (request, context: { params: Promise<{ id: string }> }) => {
  await assertCsrf(request);
  const { id } = await context.params;
  const input = schema.parse(await request.json());

  const attachment = await prisma.postAttachment.findFirst({
    where: { id: input.attachmentId, postId: id },
    select: { id: true, width: true, height: true },
  });

  if (!attachment) throw notFound('Вложение не найдено');
  if (attachment.width && attachment.height) return jsonOk({ updated: false });

  await prisma.postAttachment.update({
    where: { id: attachment.id },
    data: { width: input.width, height: input.height },
  });

  return jsonOk({ updated: true });
});
