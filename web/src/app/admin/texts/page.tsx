import { AdminTexts } from './AdminTexts';
import { getTexts } from '@/server/texts';
import { CONTENT_PAGES, readContent, type ContentSlug } from '@/lib/content';

export const dynamic = 'force-dynamic';

export default async function AdminTextsPage() {
  const slugs = Object.keys(CONTENT_PAGES) as ContentSlug[];
  const [texts, pages] = await Promise.all([
    getTexts(),
    Promise.all(
      slugs.map(async (slug) => ({
        slug,
        title: CONTENT_PAGES[slug].title,
        body: await readContent(slug),
      })),
    ),
  ]);

  return (
    <>
      <div className="section-title">
        <h2>Тексты страниц</h2>
      </div>
      <p className="muted">
        Все надписи сайта по страницам: заголовки, описания для поиска, кнопки, заглушки,
        подсказки. Большие тексты «О KRUG», «Zero Season», «Как попасть» и «Угол» правятся
        на вкладке своей страницы, там же. Пустое поле возвращает исходный текст.
      </p>
      <AdminTexts texts={texts} contentPages={pages} />
    </>
  );
}
