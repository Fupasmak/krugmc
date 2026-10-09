'use client';

import { useRouter } from 'next/navigation';
import styles from '../points.module.css';
import { CATEGORY_LABELS, POINT_CATEGORIES } from '@/lib/points';
import { EntryTable, type EntryView } from '../EntryTable';

type Filters = { admin: string; player: string; category: string; week: string };

export function JournalView({
  entries,
  admins,
  players,
  weeks,
  filters,
}: {
  entries: EntryView[];
  admins: { id: string; nickname: string }[];
  players: { id: string; nickname: string }[];
  weeks: { id: string; number: number }[];
  filters: Filters;
}) {
  const router = useRouter();

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value) as [string, string][],
  ).toString();

  function update(key: keyof Filters, value: string) {
    const next = new URLSearchParams(
      Object.entries({ ...filters, [key]: value }).filter(([, item]) => item) as [string, string][],
    ).toString();
    router.push(next ? `/admin/points/journal?${next}` : '/admin/points/journal');
  }

  return (
    <>
      <div className={styles.toolbar}>
        <label className="field">
          <span className="field__label">Админ</span>
          <select className="input" value={filters.admin} onChange={(event) => update('admin', event.target.value)}>
            <option value="">Все</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.nickname}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Игрок</span>
          <select className="input" value={filters.player} onChange={(event) => update('player', event.target.value)}>
            <option value="">Все</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.nickname}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Категория</span>
          <select
            className="input"
            value={filters.category}
            onChange={(event) => update('category', event.target.value)}
          >
            <option value="">Все</option>
            {POINT_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Неделя</span>
          <select className="input" value={filters.week} onChange={(event) => update('week', event.target.value)}>
            <option value="">Все</option>
            {weeks.map((week) => (
              <option key={week.id} value={week.id}>
                {week.number}
              </option>
            ))}
          </select>
        </label>
        <a className="btn btn--sm" href={`/api/admin/points/export/journal.csv${query ? `?${query}` : ''}`}>
          CSV
        </a>
      </div>

      <p className={styles.meta}>Показаны последние {entries.length} записей. Удалять нельзя, только отменять.</p>
      <EntryTable entries={entries} showPlayer />
    </>
  );
}
