import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { isAllowedImageHost } from '@/server/telegram-channel';

/**
 * Прокси картинок из постов канала.
 *
 * Отдавать ссылки Telegram напрямую нельзя: это чужой домен в CSP и чужой
 * кэш. Пускаем только известные хосты Telegram, переводим в WebP и держим
 * копию на диске, чтобы не ходить к Telegram на каждый просмотр профиля.
 */

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'tg-images');
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

const headers = {
  'Content-Type': 'image/webp',
  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get('src');
  if (!source) return new Response('Нет адреса', { status: 400 });

  let target: URL;
  try {
    target = new URL(source);
  } catch {
    return new Response('Кривой адрес', { status: 400 });
  }

  if (target.protocol !== 'https:' || !isAllowedImageHost(target.hostname)) {
    return new Response('Чужой адрес', { status: 403 });
  }

  const cacheFile = path.join(
    CACHE_DIR,
    `${crypto.createHash('sha1').update(target.toString()).digest('hex')}.webp`,
  );

  try {
    const cached = await fsp.readFile(cacheFile);
    return new Response(new Uint8Array(cached), { headers });
  } catch {
    // копии ещё нет, забираем оригинал
  }

  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KRUGBot/1.0; +https://krugmc.ru)' },
    });

    if (!response.ok) return new Response('Картинка не забралась', { status: 502 });

    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return new Response('Это не картинка', { status: 415 });

    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > MAX_SOURCE_BYTES) {
      return new Response('Слишком большая картинка', { status: 413 });
    }

    const webp = await sharp(raw)
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    await fsp.mkdir(CACHE_DIR, { recursive: true });
    await fsp.writeFile(cacheFile, webp);

    return new Response(new Uint8Array(webp), { headers });
  } catch (error) {
    console.warn('[telegram] картинка не забралась', { host: target.hostname, error: String(error) });
    return new Response('Telegram не ответил', { status: 504 });
  }
}
