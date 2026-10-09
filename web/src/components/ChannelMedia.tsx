'use client';

import { useState } from 'react';
import styles from './ChannelPosts.module.css';
import { Lightbox, type LightboxItem } from './Lightbox';
import { PixelIcon } from './PixelIcon';

export type ChannelMediaItem = {
  kind: 'photo' | 'video' | 'sticker' | 'gif';
  url: string;
  ratio: number | null;
  duration: string | null;
};

const proxy = (url: string) => `/api/tg-image?src=${encodeURIComponent(url)}`;

/**
 * Медиа поста канала. Картинки идут через свой прокси, место под них
 * резервируется по пропорциям, клик открывает тот же просмотрщик,
 * что и вложения завозов.
 */
export function ChannelMedia({ items, postUrl }: { items: ChannelMediaItem[]; postUrl: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [broken, setBroken] = useState<string[]>([]);

  const visible = items.filter((item) => !broken.includes(item.url));
  if (visible.length === 0) return null;

  const single = visible.length === 1;

  const lightboxItems: LightboxItem[] = visible.map((item, index) => ({
    id: `${item.url}-${index}`,
    kind: 'IMAGE',
    url: proxy(item.url),
  }));

  return (
    <>
      <div className={`${styles.media} ${single ? styles.mediaSingle : styles.mediaGrid}`}>
        {visible.map((item, index) => (
          <button
            type="button"
            key={item.url}
            className={styles.mediaCell}
            style={single && item.ratio ? { aspectRatio: String(item.ratio) } : undefined}
            onClick={() => setOpen(index)}
            aria-label={item.kind === 'video' ? 'Открыть превью видео' : 'Открыть картинку'}
          >
            <img
              src={proxy(item.url)}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setBroken((list) => [...list, item.url])}
            />

            {(item.kind === 'video' || item.kind === 'gif') && (
              <span className={styles.playMark} aria-hidden="true">
                <PixelIcon name="play" size={14} />
              </span>
            )}

            {item.duration && <span className={styles.duration}>{item.duration}</span>}
            {item.kind === 'video' && (
              <a
                className={styles.watch}
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Смотреть в Telegram
              </a>
            )}
          </button>
        ))}
      </div>

      {open !== null && (
        <Lightbox items={lightboxItems} startIndex={open} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
