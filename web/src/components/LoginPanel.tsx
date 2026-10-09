'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './LoginPanel.module.css';
import { PixelIcon } from './PixelIcon';
import { BlockButton } from './BlockButton';
import { Button } from './Button';
import { ApiError, apiFetch, errorText } from '@/lib/client';
import { TextMarkup, useTexts } from './TextsProvider';

type Mode = 'idle' | 'mc' | 'tg';

/**
 * Вход двумя способами.
 * Подтверждение прилетает потоком событий (SSE), после чего вторым запросом
 * создаётся сессия: у потока заголовки уже отправлены, cookie им не поставить.
 */
export function LoginPanel({ channel }: { channel: string }) {
  const router = useRouter();
  const t = useTexts();
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const streamRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  const finish = useCallback(async () => {
    try {
      const result = await apiFetch<{ redirect: string }>('/api/auth/finish', { method: 'POST' });
      setDone(true);
      router.push(result.redirect ?? '/');
      router.refresh();
    } catch (finishError) {
      if (finishError instanceof ApiError && finishError.code === 'not_found') {
        setError(t('login.err.browser'));
        return;
      }
      setError(errorText(finishError));
    }
  }, [router, t]);

  // Запасной путь, если SSE не доходит (старый прокси, сеть оператора).
  const pollFallback = useCallback(async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const status = await apiFetch<{ state: string }>('/api/auth/status');
        if (status.state === 'confirmed') {
          await finish();
          return;
        }
        if (status.state === 'expired') {
          setError(t('login.err.expired'));
          return;
        }
        if (status.state === 'none') {
          setError(t('login.err.browser'));
          return;
        }
      } catch {
        setError(t('login.err.bot'));
        return;
      }
    }
  }, [finish, t]);

  const pollMinecraft = useCallback(async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const status = await apiFetch<{ state: string }>('/api/auth/mc/status');
        if (status.state === 'confirmed') {
          await finish();
          return;
        }
        if (status.state === 'expired') {
          setError(t('login.err.expired'));
          return;
        }
        if (status.state === 'none') {
          setError(t('login.err.browser'));
          return;
        }
      } catch {
        setError(t('login.err.browser'));
        return;
      }
    }
  }, [finish, t]);
  const listen = useCallback(() => {
    closeStream();
    const stream = new EventSource('/api/auth/stream');
    streamRef.current = stream;

    stream.addEventListener('confirmed', () => {
      closeStream();
      void finish();
    });
    stream.addEventListener('expired', () => {
      closeStream();
      setError(t('login.err.expired'));
      setCode(null);
      setDeepLink(null);
      setMode('idle');
    });
    stream.addEventListener('timeout', () => closeStream());
    stream.onerror = () => {
      closeStream();
      void pollFallback();
    };
  }, [closeStream, finish, pollFallback, t]);

  useEffect(() => () => closeStream(), [closeStream]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  async function startMinecraft() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ code: string; expiresAt: string; command: string }>(
        '/api/auth/mc/code',
        { method: 'POST' },
      );
      setCode(result.code);
      setCommand(result.command);
      setExpiresAt(new Date(result.expiresAt).getTime());
      setMode('mc');
      void pollMinecraft();
    } catch (startError) {
      setError(errorText(startError));
    } finally {
      setBusy(false);
    }
  }

  async function startTelegram() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ deepLink: string; expiresAt: string }>('/api/auth/tg/start', {
        method: 'POST',
      });
      setDeepLink(result.deepLink);
      setExpiresAt(new Date(result.expiresAt).getTime());
      setMode('tg');
      listen();
      window.open(result.deepLink, '_blank', 'noopener');
    } catch (startError) {
      setError(errorText(startError));
    } finally {
      setBusy(false);
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t('login.err.copy'));
    }
  }

  const timer =
    left > 0 ? `осталось ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <span className={styles.kicker}>{t('login.mc.kicker')}</span>
        <h2 className={styles.title}>{t('login.mc.title')}</h2>
        <TextMarkup as="p" className={styles.lead} value={t('login.mc.text')} />

        {mode === 'mc' && code ? (
          <>
            <div className={styles.code}>{code}</div>
            <ol className={styles.steps}>
              <li>{t('login.mc.step1')}</li>
              <li>{t('login.mc.step2')}</li>
            </ol>
            <div className={styles.command}>
              <span>{command}</span>
              <Button size="sm" onClick={copyCommand} title={t('login.mc.copy')}>
                <PixelIcon name="copy" size={12} />
                {copied ? t('login.mc.copied') : t('login.mc.copy')}
              </Button>
            </div>
            <div className={styles.status}>
              <span className={styles.statusDot} aria-hidden="true" />
              {t('login.mc.waiting')} {timer}
            </div>
            <Button variant="ghost" size="sm" onClick={startMinecraft} disabled={busy}>
              {t('login.mc.otherCode')}
            </Button>
          </>
        ) : (
          <>
            <ol className={styles.steps}>
              <li>{t('login.mc.how1')}</li>
              <li>
                <TextMarkup value={t('login.mc.how2')} />
              </li>
              <li>{t('login.mc.how3')}</li>
            </ol>
            <BlockButton variant="stone" block onClick={startMinecraft} disabled={busy}>
              {t('login.mc.getCode')}
            </BlockButton>
          </>
        )}

      </section>

      <section className={styles.card}>
        <span className={styles.kicker}>{t('login.tg.kicker')}</span>
        <h2 className={styles.title}>{t('login.tg.title')}</h2>
        <TextMarkup as="p" className={styles.lead} value={t('login.tg.text', { channel })} />

        {mode === 'tg' && deepLink ? (
          <>
            <div className={styles.status}>
              <span className={styles.statusDot} aria-hidden="true" />
              {t('login.tg.waiting')} {timer}
            </div>
            <a className="btn btn--telegram btn--block" href={deepLink} target="_blank" rel="noopener noreferrer">
              {t('login.tg.reopen')}
            </a>
            <span className={styles.note}>{t('login.tg.hint')}</span>
          </>
        ) : (
          <>
            <ol className={styles.steps}>
              <li>{t('login.tg.step1')}</li>
              <li>{t('login.tg.step2')}</li>
              <li>{t('login.tg.step3')}</li>
            </ol>
            <Button variant="telegram" block onClick={startTelegram} disabled={busy}>
              {t('login.tg.button')}
            </Button>
          </>
        )}
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {done && <p className={styles.ok}>{t('login.done')}</p>}
    </div>
  );
}
