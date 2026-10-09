'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './points.module.css';

const TABS = [
  { href: '/admin/points', label: 'Игроки', exact: true },
  { href: '/admin/points/award', label: 'Начислить' },
  { href: '/admin/points/week', label: 'Итоги недели' },
  { href: '/admin/points/journal', label: 'Журнал' },
  { href: '/admin/points/presets', label: 'Пресеты' },
  { href: '/admin/points/season', label: 'Сезон' },
];

export function PointsTabs() {
  const pathname = usePathname();
  return (
    <nav className={styles.tabs} aria-label="Разделы баллов">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href || pathname.startsWith('/admin/points/players')
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
