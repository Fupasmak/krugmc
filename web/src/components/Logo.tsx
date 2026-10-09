import styles from './Logo.module.css';

/**
 * Логотип KRUG: символ, вордмарк или всё вместе.
 * Символ лежит в public/logo.svg и рисуется генератором ассетов.
 */
export function Logo({
  variant = 'full',
  size = 30,
  className = '',
  hideWordOnPhone = false,
}: {
  variant?: 'mark' | 'word' | 'full';
  /** высота символа в пикселях */
  size?: number;
  className?: string;
  /** на узком экране остаётся только символ */
  hideWordOnPhone?: boolean;
}) {
  const mark = (
    <img
      className={styles.mark}
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );

  if (variant === 'mark') {
    return (
      <span className={`${styles.root} ${className}`}>
        {mark}
        <span className="visually-hidden">KRUG</span>
      </span>
    );
  }

  if (variant === 'word') {
    return <span className={`${styles.root} ${styles.word} ${className}`}>KRUG</span>;
  }

  return (
    <span
      className={`${styles.root} ${hideWordOnPhone ? styles.hideWordOnPhone : ''} ${className}`}
    >
      {mark}
      <span className={styles.word}>KRUG</span>
    </span>
  );
}
