import type { Bot } from 'grammy';
import { env } from './env.js';
import { uploadAvatar } from './site-api.js';

/**
 * Забирает аватар из Telegram и передаёт его сайту.
 * Прямую ссылку на файл Telegram отдаёт вместе с токеном бота внутри адреса,
 * поэтому такую ссылку никуда не сохраняем: скачиваем сами, отправляем байты.
 */
export async function syncAvatar(bot: Bot, tgId: number): Promise<void> {
  try {
    const photos = await bot.api.getUserProfilePhotos(tgId, { limit: 1 });
    const sizes = photos.photos[0];
    if (!sizes || sizes.length === 0) return;

    // Берём вариант поменьше: для головы в шапке большего и не надо.
    const picked = sizes.find((size) => size.width >= 160) ?? sizes[sizes.length - 1];
    const file = await bot.api.getFile(picked.file_id);
    if (!file.file_path) return;

    const response = await fetch(
      `https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${file.file_path}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 512 * 1024) return;

    await uploadAvatar({ tgId, photo: buffer, mime: 'image/jpeg' });
  } catch (error) {
    // Аватар: приятная мелочь, из-за неё вход ломать нельзя.
    console.warn('[bot] не вышло перенести аватар:', error);
  }
}
