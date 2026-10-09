import type { Metadata } from 'next';
import styles from './map.module.css';
import { MapFrame } from './MapFrame';
import { getSettings } from '@/lib/settings';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['map.title'], description: texts['map.description'] };
}

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const [settings, texts] = await Promise.all([getSettings(), getTexts()]);
  const url = process.env.MAP_UPSTREAM_URL ? '/mapview/' : settings.mapUrl.trim();

  let origin: string | null = null;
  try {
    if (url === '/mapview/') origin = "'self'";
    else {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') origin = parsed.origin;
    }
  } catch {
    origin = null;
  }

  if (!origin) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <div className={styles.emptyBox}>
            <img className={styles.emptyBlock} src="/blocks/3d/oak_log.png" alt="" />
            <span className={styles.emptyTitle}>{texts['map.empty.title']}</span>
            <SiteTextView as="p" className={styles.emptyNote} value={texts['map.empty.note']} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Разрешаем встраивать только домен карты из настроек */}
      <meta httpEquiv="Content-Security-Policy" content={`frame-src ${origin}`} />
      <MapFrame
        url={url}
        title={texts['map.title']}
        labels={{
          loading: texts['map.loading'],
          failedTitle: texts['map.failed.title'],
          failedNote: texts['map.failed.note'],
          failedButton: texts['map.failed.button'],
        }}
      />
    </div>
  );
}
