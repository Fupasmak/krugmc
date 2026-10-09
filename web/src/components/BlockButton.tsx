import Link from 'next/link';
import styles from './BlockButton.module.css';

export type BlockVariant = 'grass' | 'emerald' | 'gold' | 'stone' | 'danger';

type Common = {
  variant?: BlockVariant;
  size?: 'md' | 'sm';
  square?: boolean;
  block?: boolean;
  className?: string;
  children: React.ReactNode;
};

type AsLink = Common & { href: string } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    'href' | 'className' | 'children'
  >;

type AsButton = Common & { href?: undefined } & Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'className' | 'children'
  >;

/**
 * Кнопка-блок с текстурой. Держим её для самых важных действий:
 * вход, Zero Season, добавление завоза и два голоса.
 * Всё остальное на сайте использует обычную Button.
 */
export function BlockButton(props: AsLink | AsButton) {
  const { variant, size, square, block, className, children, ...rest } = props;

  const classes = [
    styles.button,
    styles[variant ?? 'grass'],
    size === 'sm' ? styles.sm : '',
    square ? styles.square : '',
    block ? styles.block : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const label = <span className={styles.label}>{children}</span>;

  if (props.href !== undefined) {
    const { href, ...anchorProps } = rest as { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {label}
    </button>
  );
}
