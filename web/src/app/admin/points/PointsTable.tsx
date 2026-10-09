'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminStyles from '../admin.module.css';
import styles from './points.module.css';
import { SkinHead } from '@/components/SkinHead';
import { formatPoints } from '@/lib/points';
import { formatDate, weekRange } from './format';

type Row = {
  userId: string;
  nickname: string;
  isTest: boolean;
  week: number;
  season: number;
  reserve: number;
  lastAt: string | null;
};

type Week = { id: string; number: number; startsAt: string; endsAt: string; closed: boolean };

type SortKey = 'nickname' | 'week' | 'season' | 'reserve' | 'lastAt';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; wide?: boolean }[] = [
  { key: 'nickname', label: 'Игрок' },
  { key: 'week', label: 'Неделя', numeric: true },
  { key: 'season', label: 'Сезон', numeric: true },
  { key: 'reserve', label: 'Резерв', numeric: true },
  { key: 'lastAt', label: 'Последнее', wide: true },
];

export function PointsTable({
  data,
}: {
  data: {
    season: { title: string; closed: boolean };
    currentWeekId: string;
    week: Week;
    weeks: Week[];
    rows: Row[];
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'week', desc: true });

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? data.rows.filter((row) => row.nickname.toLowerCase().includes(needle))
      : data.rows;
    const direction = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const left = a[sort.key] ?? '';
      const right = b[sort.key] ?? '';
      if (left < right) return -direction;
      if (left > right) return direction;
      return a.nickname.localeCompare(b.nickname);
    });
  }, [data.rows, query, sort]);

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, desc: !current.desc } : { key, desc: key !== 'nickname' },
    );
  }

  const weekParam = data.week.id === data.currentWeekId ? '' : `?week=${data.week.id}`;

  return (
    <>
      <p className={styles.meta}>
        {data.season.title}
        {data.season.closed ? ', сезон закрыт' : ''}. Неделя {data.week.number},{' '}
        {weekRange(data.week.startsAt, data.week.endsAt)}
        {data.week.closed ? ', закрыта' : ''}.
      </p>

      <div className={styles.toolbar}>
        <label className="field">
          <span className="field__label">Поиск по нику</span>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Fupasmak"
          />
        </label>
        <label className="field">
          <span className="field__label">Неделя</span>
          <select
            className="input"
            value={data.week.id}
            onChange={(event) =>
              router.push(
                event.target.value === data.currentWeekId
                  ? '/admin/points'
                  : `/admin/points?week=${event.target.value}`,
              )
            }
          >
            {data.weeks.map((week) => (
              <option key={week.id} value={week.id}>
                Неделя {week.number}: {weekRange(week.startsAt, week.endsAt)}
                {week.id === data.currentWeekId ? ' (текущая)' : ''}
              </option>
            ))}
          </select>
        </label>
        <a className="btn btn--sm" href={`/api/admin/points/export/players.csv${weekParam}`}>
          CSV
        </a>
        <Link className="btn btn--grass btn--sm" href="/admin/points/award">
          Начислить
        </Link>
      </div>

      <div className={adminStyles.scroll}>
        <table className={adminStyles.table}>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={column.numeric ? styles.num : column.wide ? styles.hideSm : undefined}
                  aria-sort={
                    sort.key === column.key ? (sort.desc ? 'descending' : 'ascending') : undefined
                  }
                >
                  <button type="button" className={styles.sortButton} onClick={() => toggle(column.key)}>
                    {column.label}
                    {sort.key === column.key ? (sort.desc ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td>
                  <Link href={`/admin/points/players/${row.userId}`} className={styles.player}>
                    <SkinHead name={row.nickname} size={24} />
                    {row.nickname}
                    {row.isTest && <span className={styles.test}>тест</span>}
                  </Link>
                </td>
                <td className={styles.num}>{formatPoints(row.week)}</td>
                <td className={styles.num}>{formatPoints(row.season)}</td>
                <td className={styles.num}>{formatPoints(row.reserve)}</td>
                <td className={`${styles.meta} ${styles.hideSm}`}>{formatDate(row.lastAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.meta}>
                  Никого не нашли
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
