'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './MobileNav.module.css';
import { PixelIcon } from './PixelIcon';
import type { NavItem } from './HeaderNav';
import { useTexts } from './TextsProvider';

/** Меню планшета и телефона: панель выезжает справа. */
export function MobileNav({
  items,
  isPlayer,
  loggedIn,
  telegramUrl,
  discordUrl,
}: {
  items: NavItem[];
  isPlayer: boolean;
  loggedIn: boolean;
  telegramUrl: string;
  discordUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTexts();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        type="button"
        className={`btn btn--stone btn--square ${styles.burger}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Открыть меню"
      >
        <PixelIcon name="menu" size={18} />
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.sheet} role="dialog" aria-label="Меню">
            <div className={styles.sheetHead}>
              <span className={styles.sheetTitle}>KRUG</span>
              <button
                type="button"
                className="btn btn--ghost btn--square"
                onClick={() => setOpen(false)}
                aria-label="Закрыть меню"
              >
                <PixelIcon name="close" size={16} />
              </button>
            </div>

            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.link} ${isActive(item.href) ? styles.linkActive : ''}`}
              >
                {item.label}
                {item.note && <span className={styles.note}>{item.note}</span>}
              </Link>
            ))}

            {isPlayer && (
              <Link href="/posts/new" className={styles.link}>
                <PixelIcon name="plus" size={14} />
                {t('nav.newPost')}
              </Link>
            )}

            <span className={styles.spacer} />

            <div className={styles.footer}>
              {!loggedIn && (
                <Link href="/login" className="btn btn--grass btn--block">
                  {t('nav.login')}
                </Link>
              )}
              <div className={styles.socials}>
                <a
                  className="btn btn--telegram btn--sm"
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Telegram
                </a>
                <a
                  className="btn btn--stone btn--sm"
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Discord
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
