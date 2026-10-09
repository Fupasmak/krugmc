import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { defaultTexts, SITE_TEXTS, TEXT_KEYS, type SiteTexts, type TextKey } from '@/lib/site-texts';

/**
 * Тексты сайта: значения по умолчанию из кода, поверх них правки из базы.
 * Кэш живёт в пределах одного запроса, поэтому правки видны сразу.
 */
export const getTexts = cache(async (): Promise<SiteTexts> => {
  const texts = defaultTexts();

  try {
    const rows = await prisma.siteText.findMany();
    for (const row of rows) {
      if ((TEXT_KEYS as string[]).includes(row.key)) {
        texts[row.key as TextKey] = row.value;
      }
    }
  } catch (error) {
    console.warn('[texts] не вышло прочитать тексты из базы', String(error));
  }

  return texts;
});

/** Сохраняет только изменённые значения, пустое возвращает к умолчанию. */
export async function saveTexts(
  patch: Partial<Record<TextKey, string>>,
  actorId: string,
): Promise<void> {
  const entries = Object.entries(patch) as [TextKey, string][];

  for (const [key, raw] of entries) {
    if (!(TEXT_KEYS as string[]).includes(key)) continue;

    const entry = SITE_TEXTS[key];
    const value = raw.slice(0, entry.maxLength);

    if (value.trim() === '' || value === entry.value) {
      await prisma.siteText.deleteMany({ where: { key } });
      continue;
    }

    await prisma.siteText.upsert({
      where: { key },
      create: { key, value, updatedById: actorId },
      update: { value, updatedById: actorId },
    });
  }
}

export async function resetText(key: TextKey): Promise<void> {
  await prisma.siteText.deleteMany({ where: { key } });
}
