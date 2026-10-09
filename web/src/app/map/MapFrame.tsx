'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './map.module.css';

/**
 * Карта сервера в iframe.
 *
 * Пока карта грузится, поверх висит индикатор. Если за десять секунд
 * ничего не пришло или чужой сайт запретил встраивание, показываем
 * заглушку с кнопкой открыть карту отдельной вкладкой.
 */
type Labels = { loading: string; failedTitle: string; failedNote: string; failedButton: string };

export function MapFrame({ url, title, labels }: { url: string; title: string; labels: Labels }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    timer.current = window.setTimeout(() => {
      setState((current) => (current === 'loading' ? 'failed' : current));
    }, 10000);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (state === 'failed') {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyBox}>
          <img className={styles.emptyBlock} src="/blocks/3d/command_block.png" alt="" />
          <span className={styles.emptyTitle}>{labels.failedTitle}</span>
          <p className={styles.emptyNote}>{labels.failedNote}</p>
          <a className="btn btn--sm" href={url} target="_blank" rel="noopener noreferrer">
            {labels.failedButton}
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <iframe
        className={styles.frame}
        src={url}
        title={title}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer"
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
      />

      {state === 'loading' && (
        <div className={styles.loader}>
          <span className={styles.loaderInner}>
            <img className={styles.loaderBlock} src="/blocks/3d/moss.png" alt="" />
            {labels.loading}
          </span>
        </div>
      )}
    </>
  );
}
