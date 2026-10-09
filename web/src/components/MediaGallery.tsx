'use client';

import { useState } from 'react';
import styles from './MediaGallery.module.css';
import { Lightbox, type LightboxItem } from './Lightbox';
import { VideoPlayer } from './VideoPlayer';
import { csrfToken } from '@/lib/client';

export type MediaItem = LightboxItem & { mime: string };

/**
 * Вложения завоза. Ничего не обрезаем: одно медиа идёт в родных
 * пропорциях, несколько складываются в сетку с вписыванием по ячейке.
 *
 * Если у файла в базе нет размеров (старые загрузки), берём их у браузера
 * после загрузки и тихо дописываем в базу.
 */
export function MediaGallery({ postId, items }: { postId: string; items: MediaItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (items.length === 0) return null;

  const layout =
    items.length === 1
      ? styles.single
      : items.length === 2
        ? styles.pair
        : items.length === 3
          ? styles.trio
          : styles.quad;

  async function rememberSize(attachmentId: string, width: number, height: number) {
    try {
      await fetch(`/api/posts/${postId}/media-size`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        credentials: 'same-origin',
        body: JSON.stringify({ attachmentId, width, height }),
      });
    } catch {
      // не критично: в следующий раз попробуем снова
    }
  }

  const single = items.length === 1;

  return (
    <>
      <div className={`${styles.grid} ${layout}`}>
        {items.map((item, index) =>
          item.kind === 'IMAGE' ? (
            <button
              type="button"
              key={item.id}
              className={styles.cell}
              style={
                single && item.width && item.height
                  ? { aspectRatio: `${item.width} / ${item.height}` }
                  : undefined
              }
              onClick={() => setOpen(index)}
              aria-label="Открыть картинку"
            >
              <img
                src={item.url}
                alt=""
                loading="lazy"
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                onLoad={(event) => {
                  if (item.width && item.height) return;
                  const image = event.currentTarget;
                  if (image.naturalWidth && image.naturalHeight) {
                    void rememberSize(item.id, image.naturalWidth, image.naturalHeight);
                  }
                }}
              />
            </button>
          ) : (
            <div
              key={item.id}
              className={`${styles.cell} ${styles.videoCell}`}
              style={
                single && item.width && item.height
                  ? { aspectRatio: `${item.width} / ${item.height}` }
                  : undefined
              }
            >
              <VideoPlayer
                src={item.url}
                onSizeKnown={(width, height) => {
                  if (!item.width || !item.height) void rememberSize(item.id, width, height);
                }}
              />
              <span className={styles.badge}>видео</span>
            </div>
          ),
        )}
      </div>

      {open !== null && (
        <Lightbox items={items} startIndex={open} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
