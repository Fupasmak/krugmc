'use client';

import { useState } from 'react';
import styles from './VoteButtons.module.css';
import { PixelIcon } from './PixelIcon';
import { ApiError, apiFetch, errorText } from '@/lib/client';
import { useTexts } from './TextsProvider';

export type VoteAccess =
  | 'viewer' // зритель из Telegram, голосовать можно
  | 'guest' // не вошёл
  | 'player' // игрок сервера: голосуют только зрители
  | 'author'; // свой завоз

export function VoteButtons({
  postId,
  upCount,
  downCount,
  myVote,
  access,
  channel,
  telegramUrl,
}: {
  postId: string;
  upCount: number;
  downCount: number;
  myVote: number | null;
  access: VoteAccess;
  channel: string;
  telegramUrl: string;
}) {
  const t = useTexts();
  const [counts, setCounts] = useState({ up: upCount, down: downCount });
  const [vote, setVote] = useState<number | null>(myVote);
  const [busy, setBusy] = useState(false);
  const [jump, setJump] = useState<0 | 1 | -1>(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [note, setNote] = useState<{ text: string; subscribe?: boolean } | null>(null);

  const score = counts.up - counts.down;
  const locked = vote !== null || access !== 'viewer';

  function explain() {
    if (access === 'guest') {
      setNote({ text: t('votes.guest') });
      return;
    }
    if (access === 'player') {
      setNote({ text: t('votes.player') });
      return;
    }
    if (access === 'author') {
      setNote({ text: t('votes.self') });
      return;
    }
    if (vote !== null) {
      setNote({ text: t('votes.already') });
    }
  }

  async function send(value: 1 | -1) {
    if (locked || busy) {
      explain();
      return;
    }

    setBusy(true);
    setNote(null);
    setJump(value);
    setTimeout(() => setJump(0), 300);

    try {
      const result = await apiFetch<{ upCount: number; downCount: number }>(
        `/api/posts/${postId}/vote`,
        { method: 'POST', body: JSON.stringify({ value }) },
      );
      setCounts({ up: result.upCount, down: result.downCount });
      setVote(value);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'forbidden') {
        setNote({ text: error.message, subscribe: true });
      } else if (error instanceof ApiError && error.code === 'already_voted') {
        setVote(value);
        setNote({ text: error.message });
      } else {
        setNote({ text: errorText(error) });
      }
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    setBusy(true);
    try {
      const result = await apiFetch<{ subscribed: boolean }>('/api/subscription', { method: 'POST' });
      setNote(
        result.subscribed
          ? { text: t('votes.subscribed') }
          : {
              text: t('votes.notSubscribed', { channel }),
              subscribe: true,
            },
      );
    } catch (error) {
      setNote({ text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.button} ${styles.up} ${vote === 1 ? styles.chosen : ''} ${
          jump === 1 ? styles.jump : ''
        }`}
        onClick={() => send(1)}
        disabled={locked || busy}
        onMouseEnter={locked ? explain : undefined}
        title={t('votes.up')}
        aria-label={t('votes.up')}
      >
        <PixelIcon name="up" size={15} />
      </button>

      <span
        className={`${styles.score} ${score > 0 ? styles.scorePositive : ''} ${
          score < 0 ? styles.scoreNegative : ''
        }`}
        onMouseEnter={() => setShowBreakdown(true)}
        onMouseLeave={() => setShowBreakdown(false)}
        title={`Плюсов ${counts.up}, минусов ${counts.down}`}
      >
        {score > 0 ? `+${score}` : score}
      </span>

      {showBreakdown && (
        <span className={styles.breakdown} role="status">
          +{counts.up} / -{counts.down}
        </span>
      )}

      <button
        type="button"
        className={`${styles.button} ${styles.down} ${vote === -1 ? styles.chosen : ''} ${
          jump === -1 ? styles.jump : ''
        }`}
        onClick={() => send(-1)}
        disabled={locked || busy}
        onMouseEnter={locked ? explain : undefined}
        title={t('votes.down')}
        aria-label={t('votes.down')}
      >
        <PixelIcon name="down" size={15} />
      </button>

      {note && (
        <div className={styles.note} role="status">
          <span>{note.text}</span>
          <div className={styles.noteRow}>
            {note.subscribe && (
              <>
                <a
                  className="btn btn--telegram btn--sm"
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('votes.subscribe')}
                </a>
                <button type="button" className="btn btn--sm" onClick={recheck} disabled={busy}>
                  {t('votes.check')}
                </button>
              </>
            )}
            {access === 'guest' && (
              <a className="btn btn--sm" href="/login">
                {t('votes.login')}
              </a>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNote(null)}>
              {t('votes.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
