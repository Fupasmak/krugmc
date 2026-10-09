'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Lightbox.module.css';
import { PixelIcon } from './PixelIcon';
import { VideoPlayer } from './VideoPlayer';

export type LightboxItem = {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  width?: number | null;
  height?: number | null;
};

/**
 * Просмотр вложений поверх страницы.
 *
 * Закрывается крестиком, кликом по фону, Esc, свайпом вниз и кнопкой
 * «Назад» в браузере: для этого при открытии в историю кладётся запись.
 * Прокрутка страницы под окном блокируется, фокус держится внутри.
 */
export function Lightbox({
  items,
  startIndex,
  onClose,
}: {
  items: LightboxItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [mounted, setMounted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const closingByHistory = useRef(false);

  const item = items[index];
  const many = items.length > 1;

  const go = useCallback(
    (delta: number) => {
      setIndex((value) => (value + delta + items.length) % items.length);
    },
    [items.length],
  );

  const close = useCallback(() => {
    if (!closingByHistory.current) {
      // убираем запись, добавленную при открытии
      closingByHistory.current = true;
      window.history.back();
      return;
    }
    onClose();
  }, [onClose]);

  useEffect(() => setMounted(true), []);

  // Кнопка «Назад» закрывает просмотр
  useEffect(() => {
    window.history.pushState({ lightbox: true }, '');

    const onPopState = () => {
      closingByHistory.current = true;
      onClose();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    boxRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key === 'ArrowRight' && many) go(1);
      if (event.key === 'ArrowLeft' && many) go(-1);
      if (event.key === 'Tab') {
        // фокус не должен уходить на страницу под окном
        const focusable = boxRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, video, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, go, many]);

  if (!mounted || !item) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      ref={boxRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр вложения"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        touchStart.current = null;

        if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
          close();
          return;
        }
        if (many && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          go(dx < 0 ? 1 : -1);
        }
      }}
    >
      <div className={styles.head}>
        {many && (
          <span className={styles.counter}>
            {index + 1} / {items.length}
          </span>
        )}
        <span className={styles.spacer} />
        <a className="btn btn--ghost btn--sm" href={item.url} target="_blank" rel="noopener noreferrer">
          Открыть файл
        </a>
        <button type="button" className="btn btn--sm" onClick={close} aria-label="Закрыть">
          <PixelIcon name="close" size={12} />
        </button>
      </div>

      <div className={styles.stage}>
        {many && (
          <button
            type="button"
            className={`${styles.arrow} ${styles.prev}`}
            onClick={() => go(-1)}
            aria-label="Предыдущее"
          >
            <PixelIcon name="left" size={16} />
          </button>
        )}

        {item.kind === 'IMAGE' ? (
          <img className={styles.media} src={item.url} alt="" />
        ) : (
          <div className={styles.videoWrap}>
            <VideoPlayer src={item.url} autoPlay />
          </div>
        )}

        {many && (
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            onClick={() => go(1)}
            aria-label="Следующее"
          >
            <PixelIcon name="right" size={16} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
