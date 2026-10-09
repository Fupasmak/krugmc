import Link from 'next/link';
import { renderMarkup } from '@/lib/markup';

/**
 * Заголовок секции: иконка-блок, название, тонкая линия терминала и
 * ссылка на полный раздел.
 */
export function SectionHeading({
  title,
  block,
  href,
  hrefLabel = 'Смотреть все',
  note,
  as = 'h2',
  children,
}: {
  title: string;
  /** имя файла в public/blocks, например moss.webp */
  block?: string;
  href?: string;
  hrefLabel?: string;
  note?: string;
  as?: 'h1' | 'h2';
  children?: React.ReactNode;
}) {
  const Tag = as;

  return (
    <div className="section-title">
      {block && (
        <img className="block-icon" src={`/blocks/${block}`} alt="" width={22} height={22} />
      )}
      <Tag dangerouslySetInnerHTML={{ __html: renderMarkup(title) }} />
      {note && <span className="faint">{note}</span>}
      <span className="rule" aria-hidden="true" />
      {children}
      {href && (
        <Link href={href} className="btn btn--ghost btn--sm">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
