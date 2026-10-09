import { z } from 'zod';
import { handler, jsonOk, badRequest } from '@/lib/http';
import { requirePlayer } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { checkChannelPublic, getChannelPosts, normalizeChannel } from '@/server/telegram-channel';

export const dynamic = 'force-dynamic';

const schema = z.object({ channel: z.string().trim().max(200) });

/** Сохранить свой публичный Telegram-канал. */
export const PUT = handler(async (request) => {
  await assertCsrf(request);
  const player = await requirePlayer();

  const { channel } = schema.parse(await request.json());
  const name = normalizeChannel(channel);

  if (!name) {
    throw badRequest(
      'bad_channel',
      'Не похоже на канал. Нужна ссылка вида t.me/название, имя от 5 до 32 символов из латиницы, цифр и подчёркивания',
    );
  }

  const check = await checkChannelPublic(name);
  if (!check.ok) {
    const message =
      check.error.error === 'not_found'
        ? `Канала @${name} не существует. Проверь имя`
        : check.error.error === 'private'
          ? `Канал @${name} закрытый, показать его посты не выйдет. Нужен публичный`
          : 'Telegram сейчас не отвечает. Попробуй через минуту';
    throw badRequest(check.error.error, message);
  }

  await prisma.user.update({ where: { id: player.id }, data: { tgChannel: name } });
  // сразу прогреваем кэш, чтобы профиль не ждал первую загрузку
  await getChannelPosts(name, true);

  return jsonOk({ channel: name, title: check.title });
});

/** Убрать канал из профиля. */
export const DELETE = handler(async (request) => {
  await assertCsrf(request);
  const player = await requirePlayer();

  await prisma.user.update({ where: { id: player.id }, data: { tgChannel: null } });
  return jsonOk({ channel: null });
});
