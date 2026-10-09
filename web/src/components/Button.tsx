import Link from 'next/link';

export type ButtonVariant = 'default' | 'telegram' | 'danger' | 'gold' | 'ghost';

type Common = {
  variant?: ButtonVariant;
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

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  telegram: 'btn--telegram',
  danger: 'btn--danger',
  gold: 'btn--gold',
  ghost: 'btn--ghost',
};

/** Свои пропсы отделяем от тех, что уходят в разметку. */
function splitProps(props: AsLink | AsButton) {
  const { variant, size, square, block, className, children, ...rest } = props;

  const classes = [
    'btn',
    VARIANT_CLASS[variant ?? 'default'],
    size === 'sm' ? 'btn--sm' : '',
    square ? 'btn--square' : '',
    block ? 'btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return { classes, children, rest };
}

/**
 * Обычная кнопка сайта: терминальный вид, без текстур.
 * Тёмный фон, тонкая зелёная рамка, при наведении рамка и текст загораются.
 * Стили лежат в global.css, чтобы их можно было применить и классом.
 */
export function Button(props: AsLink | AsButton) {
  const { classes, children, rest } = splitProps(props);

  if (props.href !== undefined) {
    const { href, ...anchorProps } = rest as { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
