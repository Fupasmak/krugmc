'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from './Header.module.css';
import { PixelIcon } from './PixelIcon';
import { useTexts } from './TextsProvider';

export type NavItem = { href: string; label: string; note?: string };

/**
 * Навигация десктопа: основные пункты в строке, остальные в меню «Ещё».
 * Активный пункт подчёркнут зелёной полоской.
 */
export function HeaderNav({ main, more }: { main: NavItem[]; more: NavItem[] }) {
  const pathname = usePathname();
  const t = useTexts();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = more.some((item) => isActive(item.href));

  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      {main.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
        >
          {item.label}
          {item.note && <span className={styles.navNote}>{item.note}</span>}
        </Link>
      ))}

      {more.length > 0 && (
        <div className={styles.more} ref={moreRef}>
          <button
            type="button"
            className={`${styles.navLink} ${styles.moreButton} ${
              moreActive ? styles.navLinkActive : ''
            }`}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            {t('nav.more')}
            <PixelIcon
              name="chevron"
              size={9}
              className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            />
          </button>

          {open && (
            <div className={styles.moreMenu} role="menu">
              {more.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
                >
                  {item.label}
                  {item.note && <span className={styles.navNote}>{item.note}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
