import styles from './TrailerCard.module.css';
import { parseVideoUrl } from '@/lib/youtube';

const MOSAIC = [
  'moss.webp',
  'emerald.png',
  'mossy_cobblestone.png',
  'diamond_ore.png',
  'dirt.png',
  'warped_wart.png',
  'bricks.png',
  'moss.webp',
  'deepslate_iron_ore.png',
  'emerald.png',
  'end_stone.png',
  'mossy_cobblestone.png',
];

/**
 * Трейлер проекта. Пока ссылки нет, показываем не пустую коробку, а
 * размытую мозаику из текстур с живым блоком по центру.
 */
export function TrailerCard({
  url,
  title,
  telegramUrl,
  hint,
  emptyTitle = 'Трейлер скоро',
  followLabel = 'Следить за новостями',
}: {
  url: string;
  title: string;
  telegramUrl: string;
  hint?: React.ReactNode;
  emptyTitle?: string;
  followLabel?: string;
}) {
  const video = url ? parseVideoUrl(url) : null;

  if (video?.embedUrl) {
    return (
      <div className={styles.frame}>
        <iframe
          src={video.embedUrl}
          title={title}
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={styles.frame}>
      <div className={styles.placeholder}>
        <div className={styles.mosaic} aria-hidden="true">
          {MOSAIC.map((block, index) => (
            <span key={`${block}-${index}`} style={{ backgroundImage: `url(/blocks/${block})` }} />
          ))}
        </div>
        <span className={styles.veil} aria-hidden="true" />

        <div className={styles.content}>
          <img
            className={styles.block}
            src="/blocks/3d/sculk_shrieker.gif"
            alt=""
            width={84}
            height={84}
          />
          <span className={`${styles.title} accent-type`}>{emptyTitle}</span>
          <p className={styles.note}>
            {hint ?? (
              <>
                Монтажёр ещё ищет самый <em>круглый</em> кадр.
              </>
            )}
          </p>
          <a
            className="btn btn--telegram btn--sm"
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {followLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
