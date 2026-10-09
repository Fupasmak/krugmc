'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import adminStyles from '../../admin.module.css';
import styles from '../points.module.css';
import { apiFetch, errorText } from '@/lib/client';
import { formatDate, weekRange } from '../format';

type Data = {
  season: { id: string; title: string; number: number; startsAt: string; closedAt: string | null };
  currentWeek: { id: string; number: number; startsAt: string; endsAt: string; closed: boolean };
  weeks: { id: string; number: number; startsAt: string; endsAt: string; closedAt: string | null }[];
  seasons: { id: string; title: string; number: number; closedAt: string | null }[];
};

export function SeasonControls({ data, superadmin }: { data: Data; superadmin: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      router.refresh();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  }

  function closeWeek() {
    if (!window.confirm(`Закрыть неделю ${data.currentWeek.number} сейчас? Новые начисления пойдут в следующую.`)) {
      return;
    }
    void run(async () => {
      const result = await apiFetch<{ ok: boolean; nextWeek: { number: number } }>(
        `/api/admin/points/weeks/${data.currentWeek.id}/close`,
        { method: 'POST' },
      );
      return `Неделя закрыта, началась ${result.nextWeek.number}`;
    });
  }

  function closeSeason() {
    const answer = window.prompt(
      `Закрыть ${data.season.title}? Весь резерв игроков засчитается в основной счёт, начисления в этот сезон закончатся. Отменить нельзя. Чтобы подтвердить, напиши название сезона:`,
    );
    if (answer?.trim() !== data.season.title) return;
    void run(async () => {
      const result = await apiFetch<{ ok: boolean; settled: number }>(
        `/api/admin/points/seasons/${data.season.id}/close`,
        { method: 'POST' },
      );
      return `Сезон закрыт. Резерв засчитан у игроков: ${result.settled}`;
    });
  }

  function startSeason(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch('/api/admin/points/seasons', { method: 'POST', body: JSON.stringify({ title }) });
      setTitle('');
      return 'Новый сезон начался';
    });
  }

  const closed = Boolean(data.season.closedAt);

  return (
    <>
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardValue}>{data.season.title}</span>
          <span className={styles.cardLabel}>
            {closed ? `закрыт ${formatDate(data.season.closedAt)}` : `идёт с ${formatDate(data.season.startsAt)}`}
          </span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>Неделя {data.currentWeek.number}</span>
          <span className={styles.cardLabel}>
            {weekRange(data.currentWeek.startsAt, data.currentWeek.endsAt)}, смена в понедельник 00:00 по Москве
          </span>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className={styles.plus}>{notice}</p>}

      {!closed && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Неделя</h3>
          <p className={styles.meta}>
            Недели меняются сами. Закрыть вручную можно, если итоги у костра подвели раньше.
          </p>
          <div>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={closeWeek}>
              Закрыть неделю {data.currentWeek.number}
            </button>
          </div>
        </section>
      )}

      {superadmin && !closed && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Закрыть сезон</h3>
          <p className={styles.meta}>
            Весь резерв засчитывается в основной счёт, даже не кратный 5. После этого начислять в сезон
            нельзя, остаются история и выгрузка.
          </p>
          <div>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={closeSeason}>
              Закрыть сезон
            </button>
          </div>
        </section>
      )}

      {superadmin && closed && (
        <form className={styles.panel} onSubmit={startSeason}>
          <h3 className={styles.panelTitle}>Новый сезон</h3>
          <label className="field">
            <span className="field__label">Название</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div>
            <button type="submit" className="btn btn--grass btn--sm" disabled={busy || title.trim().length < 2}>
              Начать сезон
            </button>
          </div>
        </form>
      )}

      {!superadmin && (
        <p className={styles.meta}>Закрывает сезон и начинает новый главный администратор.</p>
      )}

      <h3 className={styles.panelTitle}>Недели сезона</h3>
      <div className={adminStyles.scroll}>
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th>№</th>
              <th>Даты</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((week) => (
              <tr key={week.id}>
                <td className={styles.num}>{week.number}</td>
                <td>{weekRange(week.startsAt, week.endsAt)}</td>
                <td className={styles.meta}>{week.closedAt ? `закрыта ${formatDate(week.closedAt)}` : 'идёт'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
