import styles from './ContentPage.module.css';
import { extractHeadings, renderContentMarkdown, withHeadingIds } from '@/lib/markdown';

/**
 * Страница-текст: «Что такое KRUG», «Zero Season», «Как попасть», «Угол».
 * Оглавление собирается из заголовков второго уровня.
 */
export function ContentPage({
  title,
  markdown,
  decoration,
  intro,
  after,
  showToc = true,
}: {
  title: string;
  markdown: string;
  decoration?: React.ReactNode;
  intro?: React.ReactNode;
  after?: React.ReactNode;
  showToc?: boolean;
}) {
  const rendered = withHeadingIds(renderContentMarkdown(markdown));
  const headings = extractHeadings(rendered);
  const withToc = showToc && headings.length > 2;

  return (
    <div className={styles.wrap}>
      {decoration}

      <div className="container page">
        <div className="section-title">
          <h1>{title}</h1>
        </div>
        {intro}

        <div className={`${styles.layout} ${withToc ? '' : styles.layoutPlain}`}>
          <article className={`${styles.body} prose`} dangerouslySetInnerHTML={{ __html: rendered }} />

          {withToc && (
            <nav className={styles.toc} aria-label="Содержание">
              <span className={styles.tocTitle}>Содержание</span>
              {headings.map((heading) => (
                <a key={heading.id} className={styles.tocLink} href={`#${heading.id}`}>
                  {heading.title}
                </a>
              ))}
            </nav>
          )}
        </div>
        {after}
      </div>
    </div>
  );
}
