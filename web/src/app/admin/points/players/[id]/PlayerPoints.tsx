'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../points.module.css';
import { SkinHead } from '@/components/SkinHead';
import { apiFetch, errorText } from '@/lib/client';
import { formatPoints, parsePoints } from '@/lib/points';
import { EntryTable, type EntryView } from '../../EntryTable';

type Data = {
  season: { id: string; title: string; closed: boolean };
  player: { userId: string; nickname: string; isTest: boolean };
  totals: { main: number; reserve: number; maxWithdraw: number };
  invitedBy: { userId: string; nickname: string } | null;
  invited: { userId: string; nickname: string }[];
  inviterOptions: { userId: string; nickname: string }[];
  entries: EntryView[];
};

export function PlayerPoints({ data }: { data: Data }) {
  const router = useRouter();
  const [inviter, setInviter] = useState(data.invitedBy?.userId ?? '');
  const [withdraw, setWithdraw] = useState(
    data.totals.maxWithdraw ? formatPoints(data.totals.maxWithdraw) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      router.refresh();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  }

  function saveReferral() {
    void run(async () => {
      await apiFetch(`/api/admin/points/players/${data.player.userId}/referral`, {
        method: 'PATCH',
        body: JSON.stringify({ inviterUserId: inviter || null }),
      });
    }, 'Пригласившего сохранили');
  }

  function doWithdraw() {
    const amount = parsePoints(withdraw);
    if (amount === null) {
      setError('Сумма вывода: число, кратное 5');
      return;
    }
    if (!window.confirm(`Перевести ${formatPoints(amount)} из резерва в основной счёт?`)) return;
    void run(async () => {
      await apiFetch(`/api/admin/points/players/${data.player.userId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    }, 'Вывели из резерва');
  }

  const locked = data.season.closed;

  return (
    <>
      <div className={styles.inline} style={{ marginBottom: 'var(--gap)' }}>
        <SkinHead name={data.player.nickname} size={40} />
        <h3 className={styles.panelTitle}>{data.player.nickname}</h3>
        {data.player.isTest && <span className={styles.test}>тестовый аккаунт</span>}
        {!locked && (
          <Link
            className="btn btn--grass btn--sm"
            href={`/admin/points/award?player=${data.player.userId}`}
          >
            Начислить
          </Link>
        )}
      </div>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardValue}>{formatPoints(data.totals.main)}</span>
          <span className={styles.cardLabel}>за сезон, {data.season.title}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{formatPoints(data.totals.reserve)}</span>
          <span className={styles.cardLabel}>в резерве</span>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className={styles.plus}>{notice}</p>}

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Рефералы</h3>
        <p className={styles.meta}>
          С каждого начисления приглашённому пригласивший получает 30% в резерв. Приглашённые сами
          приглашать не могут.
        </p>
        <div className={styles.toolbar}>
          <label className="field" style={{ flex: 1, minWidth: 200 }}>
            <span className="field__label">Кто пригласил</span>
            <select
              className="input"
              value={inviter}
              disabled={locked || data.invited.length > 0}
              onChange={(event) => setInviter(event.target.value)}
            >
              <option value="">Никто</option>
              {data.inviterOptions.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.nickname}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--sm"
            disabled={busy || locked || inviter === (data.invitedBy?.userId ?? '')}
            onClick={saveReferral}
          >
            Сохранить
          </button>
        </div>
        {data.invited.length > 0 && (
          <p className={styles.meta}>
            Пригласил:{' '}
            {data.invited.map((row, index) => (
              <span key={row.userId}>
                {index > 0 && ', '}
                <Link href={`/admin/points/players/${row.userId}`}>{row.nickname}</Link>
              </span>
            ))}
            . Раз этот игрок сам приглашал, приглашённым он быть не может.
          </p>
        )}
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Вывод из резерва</h3>
        <p className={styles.meta}>
          Сумма кратна 5 и не меньше 10. Остаток лежит дальше, в конце сезона засчитывается весь.
          {data.totals.maxWithdraw > 0
            ? ` Сейчас можно вывести до ${formatPoints(data.totals.maxWithdraw)}.`
            : ' Сейчас выводить нечего.'}
        </p>
        <div className={styles.toolbar}>
          <label className="field" style={{ width: 140 }}>
            <span className="field__label">Сколько</span>
            <input
              className="input"
              inputMode="decimal"
              value={withdraw}
              onChange={(event) => setWithdraw(event.target.value)}
              disabled={locked || data.totals.maxWithdraw === 0}
            />
          </label>
          <button
            type="button"
            className="btn btn--sm"
            disabled={busy || locked || data.totals.maxWithdraw === 0}
            onClick={doWithdraw}
          >
            Вывести из резерва
          </button>
        </div>
      </section>

      <section>
        <h3 className={styles.panelTitle} style={{ marginBottom: 'var(--gap-sm)' }}>
          История
        </h3>
        <EntryTable entries={data.entries} canRevert={!locked} />
      </section>
    </>
  );
}
