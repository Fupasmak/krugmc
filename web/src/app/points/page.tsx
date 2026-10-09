import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './points.module.css';
import { getTexts } from '@/server/texts';
import { renderMarkup } from '@/lib/markup';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['points.pageTitle'], description: texts['points.description'] };
}

export const dynamic = 'force-dynamic';

const DIRECTIONS = [
  { key: 'event', block: 'command_block.png' },
  { key: 'social', block: 'slime.png' },
  { key: 'community', block: 'moss.png' },
  { key: 'content', block: 'sculk_shrieker.gif' },
] as const;

const EXTRAS = [
  { key: 'scale', block: 'deepslate_diamond_ore.png' },
  { key: 'campfire', block: 'oak_log.png' },
  { key: 'friends', block: 'diamond_ore.png' },
] as const;

export default async function PointsPage() {
  const texts = await getTexts();

  return (
    <div className="container page">
      <header className={styles.head}>
        <h1 className={styles.title} dangerouslySetInnerHTML={{ __html: renderMarkup(texts['points.title']) }} />
        <SiteTextView as="p" className={styles.lead} value={texts['points.lead']} />
      </header>

      <ul className={styles.directions}>
        {DIRECTIONS.map((item) => (
          <li key={item.key} className={styles.direction}>
            <img
              className={styles.block}
              src={`/blocks/3d/${item.block}`}
              alt=""
              width={72}
              height={72}
              loading="lazy"
            />
            <h2
              className={styles.directionTitle}
              dangerouslySetInnerHTML={{ __html: renderMarkup(texts[`points.${item.key}.title`]) }}
            />
            <SiteTextView as="p" className={styles.text} value={texts[`points.${item.key}.text`]} />
          </li>
        ))}
      </ul>

      <div className={styles.extras}>
        {EXTRAS.map((item) => (
          <section key={item.key} className={styles.extra}>
            <img
              className={styles.extraBlock}
              src={`/blocks/3d/${item.block}`}
              alt=""
              width={48}
              height={48}
              loading="lazy"
            />
            <div>
              <h2
                className={styles.extraTitle}
                dangerouslySetInnerHTML={{ __html: renderMarkup(texts[`points.${item.key}.title`]) }}
              />
              <SiteTextView as="p" className={styles.text} value={texts[`points.${item.key}.text`]} />
            </div>
          </section>
        ))}
      </div>

      <footer className={styles.foot}>
        <SiteTextView as="p" className={styles.note} value={texts['points.note']} />
        <Link href="/zero" className="btn btn--ghost btn--sm">
          {texts['points.zeroLink']}
        </Link>
      </footer>
    </div>
  );
}
