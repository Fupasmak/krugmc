import Link from 'next/link';
import { AdminSettings } from './AdminSettings';
import { getSettings } from '@/lib/settings';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <div className="section-title">
        <h2>Настройки</h2>
      </div>

      <div className={styles.form}>
        <strong>Тексты и баллы</strong>
        <span className="field__hint">
          Все надписи сайта по страницам, включая большие тексты «О KRUG», «Zero Season», «Как
          попасть» и страницу «Баллы». Суммы и правила начисления живут в разделе баллов.
        </span>
        <div className={styles.formRow}>
          <Link href="/admin/texts" className="btn btn--sm">
            Тексты всех страниц
          </Link>
          <Link href="/admin/points/presets" className="btn btn--ghost btn--sm">
            Пресеты баллов
          </Link>
          <Link href="/admin/points/season" className="btn btn--ghost btn--sm">
            Сезон и недели
          </Link>
        </div>
      </div>

      <AdminSettings settings={settings} />
    </>
  );
}
