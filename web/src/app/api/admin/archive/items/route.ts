import { handler, jsonOk, badRequest, notFound } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { archiveItemSchema } from '@/lib/validation';
import { parseUpload, deleteUpload } from '@/lib/uploads';
import { audit, findPlayerByNickname } from '@/server/admin';
import { isSupportedVideoUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

/**
 * Пункт архива: постройка, арт, видео, жизнь сервера.
 * Принимает и multipart (с файлом), и обычный JSON (ссылка на видео).
 */
export const POST = handler(async (request) => {
  await assertCsrf(request);
  const actor = await requireAdmin();

  const contentType = request.headers.get('content-type') ?? '';
  let fields: Record<string, string>;
  let filePath: string | null = null;

  if (contentType.startsWith('multipart/form-data')) {
    const parsed = await parseUpload(request, { maxFiles: 1, allowVideo: true });
    fields = parsed.fields;
    filePath = parsed.files[0]?.path ?? null;
  } else {
    fields = (await request.json()) as Record<string, string>;
  }

  try {
    const input = archiveItemSchema.parse(fields);

    const week = await prisma.archiveWeek.findUnique({ where: { id: input.weekId } });
    if (!week) throw notFound('Неделя не найдена');

    if (!filePath && !input.url) {
      throw badRequest('nothing_to_add', 'Нужен файл или ссылка');
    }
    if (input.url && input.kind === 'VIDEO' && !isSupportedVideoUrl(input.url)) {
      throw badRequest('bad_video_url', 'Поддерживаются ссылки YouTube и VK');
    }

    const author = input.authorNickname ? await findPlayerByNickname(input.authorNickname) : null;

    const item = await prisma.archiveItem.create({
      data: {
        weekId: week.id,
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        path: filePath,
        url: input.url ?? null,
        authorId: author?.id ?? null,
        order: input.order ?? 0,
      },
    });

    await audit({ actor, action: 'archive.item.create', target: item.title });
    return jsonOk({ item: { id: item.id } }, { status: 201 });
  } catch (error) {
    if (filePath) await deleteUpload(filePath);
    throw error;
  }
});
