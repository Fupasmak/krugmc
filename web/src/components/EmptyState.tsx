import styles from './EmptyState.module.css';
import { Button } from './Button';
import { renderMarkup } from '@/lib/markup';

/**
 * Пустое состояние для всех разделов сразу: лента без завозов, архив без
 * недель, поиск без совпадений. Сундука в наборе блоков нет, поэтому по
 * умолчанию стоит командный блок.
 */
export function EmptyState({
  title,
  note,
  block = 'command_block.png',
  action,
  compact = false,
}: {
  title: string;
  note?: React.ReactNode;
  /** имя файла в public/blocks/3d */
  block?: string;
  action?: { href: string; label: string };
  compact?: boolean;
}) {
  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <img className={styles.block} src={`/blocks/3d/${block}`} alt="" width={72} height={72} />
      <span
        className={`${styles.title} accent-type`}
        dangerouslySetInnerHTML={{ __html: renderMarkup(title) }}
      />
      {note && <p className={styles.note}>{note}</p>}
      {action && (
        <Button href={action.href} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
