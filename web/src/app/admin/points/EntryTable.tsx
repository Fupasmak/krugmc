'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import adminStyles from '../admin.module.css';
import styles from './points.module.css';
import { apiFetch, errorText } from '@/lib/client';
import { CATEGORY_LABELS, KIND_LABELS, formatPoints, type PointCategoryKey } from '@/lib/points';
import { formatDate } from './format';

export type EntryView = {
  id: string;
  createdAt: string;
  kind: string;
  bucket: 'MAIN' | 'RESERVE';
  category: PointCategoryKey | null;
  amount: number;
  comment: string;
  proofUrl: string | null;
  post: { id: string; title: string } | null;
  presetTitle: string | null;
  actor: string;
  playerId: string;
  player: string;
  weekNumber: number;
  reverted: boolean;
  revertable: boolean;
  from: string | null;
};

export function EntryTable({
  entries,
  showPlayer = false,
  canRevert = true,
}: {
  entries: EntryView[];
  showPlayer?: boolean;
  canRevert?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revert(entry: EntryView) {
    const reason = window.prompt(
      `Отменить ${formatPoints(entry.amount, true)} у ${entry.player}? Напиши причину:`,
    );
    if (!reason || reason.trim().length < 3) return;
    setBusy(entry.id);
    setError(null);
    try {
      await apiFetch(`/api/admin/points/entries/${entry.id}/revert`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      router.refresh();
    } catch (revertError) {
      setError(errorText(revertError));
    } finally {
      setBusy(null);
    }
  }

  if (entries.length === 0) {
    return <p className={styles.meta}>Начислений пока нет.</p>;
  }

  return (
    <>
      {error && <p className="error-text">{error}</p>}
      <div className={adminStyles.scroll}>
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>Когда</th>
              {showPlayer && <th>Игрок</th>}
              <th>За что</th>
              <th className={styles.num}>Баллы</th>
              <th className={styles.hideSm}>Выдал</th>
              {canRevert && <th aria-label="Действия" />}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className={entry.reverted ? styles.reverted : undefined}>
                <td className={styles.meta}>
                  {formatDate(entry.createdAt)}
                  <br />
                  неделя {entry.weekNumber}
                </td>
                {showPlayer && (
                  <td>
                    <Link href={`/admin/points/players/${entry.playerId}`}>{entry.player}</Link>
                  </td>
                )}
                <td>
                  <span className={styles.meta}>
                    {KIND_LABELS[entry.kind] ?? entry.kind}
                    {entry.category ? `, ${CATEGORY_LABELS[entry.category]}` : ''}
                    {entry.bucket === 'RESERVE' ? ', резерв' : ''}
                  </span>
                  <br />
                  {entry.presetTitle && <strong>{entry.presetTitle}. </strong>}
                  {entry.comment}
                  {entry.from && <span className={styles.meta}> (от {entry.from})</span>}
                  {(entry.proofUrl || entry.post) && (
                    <span className={styles.inline}>
                      {entry.proofUrl && (
                        <a href={entry.proofUrl} target="_blank" rel="noopener noreferrer">
                          ссылка
                        </a>
                      )}
                      {entry.post && <Link href={`/posts/${entry.post.id}`}>{entry.post.title}</Link>}
                    </span>
                  )}
                </td>
                <td
                  className={`${styles.num} ${entry.amount < 0 ? styles.minus : styles.plus}`}
                >
                  {formatPoints(entry.amount, true)}
                </td>
                <td className={`${styles.meta} ${styles.hideSm}`}>{entry.actor}</td>
                {canRevert && (
                  <td>
                    {entry.revertable && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={busy === entry.id}
                        onClick={() => void revert(entry)}
                      >
                        Отменить
                      </button>
                    )}
                    {entry.reverted && <span className={styles.meta}>отменено</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
