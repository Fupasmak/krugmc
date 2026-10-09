import Link from 'next/link';
import { redirect } from 'next/navigation';
import styles from './admin.module.css';
import { currentUser, isAdmin } from '@/lib/auth';

export const metadata = {
  title: 'Админка',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

const SECTIONS = [
  { href: '/admin', label: 'Сводка' },
  { href: '/admin/players', label: 'Игроки' },
  { href: '/admin/points', label: 'Баллы' },
  { href: '/admin/posts', label: 'Завозы' },
  { href: '/admin/archive', label: 'Архив' },
  { href: '/admin/media', label: 'Медиа' },
  { href: '/admin/wiki', label: 'Вики' },
  { href: '/admin/texts', label: 'Тексты страниц' },
  { href: '/admin/settings', label: 'Настройки' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/');

  return (
    <div className="container page">
      <div className="section-title">
        <h1>Админка</h1>
        <span className="faint">
          {user.mcNickname} · {user.role === 'SUPERADMIN' ? 'главный админ' : 'админ'}
        </span>
      </div>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Разделы админки">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className={styles.navLink}>
              {section.label}
            </Link>
          ))}
        </nav>

        <div>{children}</div>
      </div>
    </div>
  );
}
