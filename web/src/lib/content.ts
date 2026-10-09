import 'server-only';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './prisma';

/**
 * Тексты страниц («Что такое KRUG», «Zero Season», «Как попасть»).
 * Исходник: файл в web/content. Если админ поправил текст через админку,
 * версия из базы перекрывает файл: деплой для правки текста не нужен.
 */

export const CONTENT_PAGES = {
  about: { file: 'about.md', title: 'Что такое KRUG' },
  zero: { file: 'zero-season.md', title: 'Zero Season' },
  join: { file: 'join.md', title: 'Как попасть' },
  corner: { file: 'corner.md', title: 'Угол' },
} as const;

export type ContentSlug = keyof typeof CONTENT_PAGES;

export function isContentSlug(value: string): value is ContentSlug {
  return Object.hasOwn(CONTENT_PAGES, value);
}

function settingKey(slug: ContentSlug) {
  return `content:${slug}`;
}

export async function readContent(slug: ContentSlug): Promise<string> {
  const override = await prisma.siteSetting.findUnique({ where: { key: settingKey(slug) } });
  if (override && typeof override.value === 'object' && override.value !== null) {
    const body = (override.value as { body?: string }).body;
    if (typeof body === 'string' && body.trim()) return body;
  }

  const filePath = path.resolve(process.cwd(), 'content', CONTENT_PAGES[slug].file);
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch {
    return `# ${CONTENT_PAGES[slug].title}\n\nТекст пока не написан.`;
  }
}

export async function writeContent(slug: ContentSlug, body: string) {
  await prisma.siteSetting.upsert({
    where: { key: settingKey(slug) },
    create: { key: settingKey(slug), value: { body } },
    update: { value: { body } },
  });
}

/** Вернуть страницу к тексту из файла. */
export async function resetContent(slug: ContentSlug) {
  await prisma.siteSetting.deleteMany({ where: { key: settingKey(slug) } });
}
