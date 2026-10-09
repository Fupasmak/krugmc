import { renderMarkup } from '@/lib/markup';

/** Вывод текста из настроек с мини-разметкой. */
export function SiteTextView({
  value,
  as: Tag = 'span',
  className,
}: {
  value: string;
  as?: 'span' | 'p' | 'div';
  className?: string;
}) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: renderMarkup(value) }} />;
}
