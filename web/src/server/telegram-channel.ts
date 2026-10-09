import 'server-only';
import sanitizeHtml from 'sanitize-html';
import { prisma } from '@/lib/prisma';

/**
 * Последние посты публичного Telegram-канала.
 *
 * Берём веб-версию канала (t.me/s/<name>) и разбираем её сами. Готовый
 * виджет Telegram не годится: он тянет свой стиль и почти не красится.
 * Разметка Telegram может поменяться, поэтому весь разбор собран в одном
 * модуле, а любая ошибка превращается в заглушку, а не в падение страницы.
 */

export const CHANNEL_POSTS_LIMIT = 3;
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 9000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

/**
 * Домены картинок Telegram. Превью раздаются с нумерованных поддоменов
 * вроде cdn4.telesco.pe, поэтому сверяем суффикс, а не точное имя.
 */
const IMAGE_HOST_SUFFIXES = ['telesco.pe', 'cdn-telegram.org', 'telegram.org'];

export function isAllowedImageHost(hostname: string): boolean {
  return IMAGE_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

export type ChannelMediaKind = 'photo' | 'video' | 'sticker' | 'gif';

export type ChannelMedia = {
  kind: ChannelMediaKind;
  url: string;
  /** отношение ширины к высоте, Telegram отдаёт его в padding-top обёртки */
  ratio: number | null;
  duration: string | null;
};

export type ChannelPost = {
  id: string;
  url: string;
  html: string;
  media: ChannelMedia[];
  date: string | null;
  views: string | null;
};

export type ChannelError = 'not_found' | 'private' | 'unreachable' | 'parse_failed';

export type ChannelFailure = { ok: false; channel: string; error: ChannelError };

export type ChannelResult =
  | { ok: true; channel: string; title: string | null; posts: ChannelPost[]; cached: boolean }
  | ChannelFailure;

const CHANNEL_NAME = /^[A-Za-z0-9_]{5,32}$/;

/** Приводит «@name», «t.me/name», «https://t.me/name» к «name». */
export function normalizeChannel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let name = trimmed;
  name = name.replace(/^https?:\/\//i, '');
  name = name.replace(/^t\.me\//i, '');
  name = name.replace(/^telegram\.me\//i, '');
  name = name.replace(/^s\//i, '');
  name = name.replace(/^@/, '');
  name = name.split(/[/?#]/)[0] ?? '';

  return CHANNEL_NAME.test(name) ? name : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const POST_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'strong', 'i', 'em', 's', 'u', 'code', 'pre', 'br', 'a', 'blockquote'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tg'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { href: attribs.href ?? '#', rel: 'noopener noreferrer nofollow ugc', target: '_blank' },
    }),
  },
};

/** Отношение сторон Telegram прячет в padding-top обёртки медиа. */
function ratioFromPadding(chunk: string): number | null {
  const match = /padding-top:\s*([\d.]+)%/.exec(chunk);
  if (!match) return null;
  const percent = Number(match[1]);
  if (!Number.isFinite(percent) || percent <= 0) return null;
  return Number((100 / percent).toFixed(4));
}

function pickMedia(block: string): ChannelMedia[] {
  const media: ChannelMedia[] = [];
  const seen = new Set<string>();

  // Каждое медиа это кусок разметки со своей фоновой картинкой.
  // Тип определяем по классам этого куска, пропорции по padding-top.
  const chunks = block.split(/(?=<a |<i |<div |<video )/);

  for (const chunk of chunks) {
    const urlMatch = /background-image:\s*url\('([^']+)'\)/.exec(chunk);
    if (!urlMatch) continue;

    const url = decodeEntities(urlMatch[1]);
    if (seen.has(url)) continue;

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !isAllowedImageHost(parsed.hostname)) continue;
    } catch {
      continue;
    }

    const isSticker = chunk.includes('tgme_widget_message_sticker');
    const isVideo = chunk.includes('tgme_widget_message_video');
    const isGif = chunk.includes('message_gif') || chunk.includes('tgme_widget_message_roundvideo');

    const kind: ChannelMediaKind = isSticker
      ? 'sticker'
      : isGif
        ? 'gif'
        : isVideo
          ? 'video'
          : 'photo';

    const durationMatch = /tgme_widget_message_video_duration">([^<]+)</.exec(chunk);

    seen.add(url);
    media.push({
      kind,
      url,
      ratio: ratioFromPadding(chunk),
      duration: durationMatch ? decodeEntities(durationMatch[1]).trim() : null,
    });
  }

  return media.slice(0, 6);
}

/** Достаёт из HTML страницы канала последние посты. */
export function parseChannelHtml(html: string, limit = CHANNEL_POSTS_LIMIT): ChannelPost[] {
  const posts: ChannelPost[] = [];
  const blocks = html.split('class="tgme_widget_message ').slice(1);

  for (const block of blocks) {
    const idMatch = /data-post="([^"]+)"/.exec(block);
    if (!idMatch) continue;

    const textMatch = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block);

    const dateMatch = /<time[^>]+datetime="([^"]+)"/.exec(block);
    const viewsMatch = /class="tgme_widget_message_views">([^<]+)</.exec(block);

    const id = decodeEntities(idMatch[1]);

    posts.push({
      id,
      url: `https://t.me/${id}`,
      html: sanitizeHtml(textMatch ? textMatch[1] : '', POST_OPTIONS).trim(),
      media: pickMedia(block),
      date: dateMatch ? dateMatch[1] : null,
      views: viewsMatch ? decodeEntities(viewsMatch[1]).trim() : null,
    });
  }

  // Telegram отдаёт посты от старых к новым, нам нужны свежие
  return posts.reverse().slice(0, limit);
}

async function download(channel: string): Promise<{ html: string } | { error: ChannelFailure }> {
  try {
    const response = await fetch(`https://t.me/s/${channel}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // без узнаваемого агента Telegram иногда отдаёт пустую страницу
        'User-Agent': 'Mozilla/5.0 (compatible; KRUGBot/1.0; +https://krugmc.ru)',
        'Accept-Language': 'ru,en;q=0.8',
      },
      cache: 'no-store',
    });

    if (response.status === 404) {
      return { error: { ok: false, channel, error: 'not_found' } };
    }
    if (!response.ok) {
      return { error: { ok: false, channel, error: 'unreachable' } };
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return { error: { ok: false, channel, error: 'parse_failed' } };
    }

    // У закрытого канала веб-версии нет, Telegram отдаёт страницу-приглашение
    if (!html.includes('tgme_channel_info') && !html.includes('tgme_widget_message')) {
      return { error: { ok: false, channel, error: 'private' } };
    }

    return { html };
  } catch (error) {
    console.warn('[telegram] канал не забрался', { channel, error: String(error) });
    return { error: { ok: false, channel, error: 'unreachable' } };
  }
}

/** Проверка при сохранении канала в профиле: существует и публичный. */
export async function checkChannelPublic(
  channel: string,
): Promise<{ ok: true; title: string | null } | { ok: false; error: ChannelFailure }> {
  const result = await download(channel);
  if ('error' in result) return { ok: false, error: result.error };

  const titleMatch = /<div class="tgme_channel_info_header_title"[^>]*><span[^>]*>([^<]+)</.exec(
    result.html,
  );

  return { ok: true, title: titleMatch ? decodeEntities(titleMatch[1]).trim() : null };
}

/** Посты канала с кэшем: Telegram не дёргаем на каждый заход в профиль. */
export async function getChannelPosts(channel: string, force = false): Promise<ChannelResult> {
  const cached = await prisma.telegramChannelCache.findUnique({ where: { channel } });

  if (!force && cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cached.ok
      ? {
          ok: true,
          channel,
          title: cached.title,
          posts: cached.posts as unknown as ChannelPost[],
          cached: true,
        }
      : { ok: false, channel, error: (cached.error as ChannelError | null) ?? 'unreachable' };
  }

  const result = await download(channel);

  if ('error' in result) {
    await prisma.telegramChannelCache.upsert({
      where: { channel },
      create: { channel, posts: [], ok: false, error: result.error.error, fetchedAt: new Date() },
      update: { posts: [], ok: false, error: result.error.error, fetchedAt: new Date() },
    });
    return result.error;
  }

  let posts: ChannelPost[] = [];
  try {
    posts = parseChannelHtml(result.html);
  } catch (error) {
    console.warn('[telegram] разбор страницы не удался', { channel, error: String(error) });
    posts = [];
  }

  if (posts.length === 0) {
    await prisma.telegramChannelCache.upsert({
      where: { channel },
      create: { channel, posts: [], ok: false, error: 'parse_failed', fetchedAt: new Date() },
      update: { posts: [], ok: false, error: 'parse_failed', fetchedAt: new Date() },
    });
    return { ok: false, channel, error: 'parse_failed' };
  }

  const titleMatch = /<div class="tgme_channel_info_header_title"[^>]*><span[^>]*>([^<]+)</.exec(
    result.html,
  );
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : null;

  await prisma.telegramChannelCache.upsert({
    where: { channel },
    create: { channel, posts: posts as never, title, ok: true, error: null, fetchedAt: new Date() },
    update: { posts: posts as never, title, ok: true, error: null, fetchedAt: new Date() },
  });

  return { ok: true, channel, title, posts, cached: false };
}
