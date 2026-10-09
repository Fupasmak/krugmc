'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import { apiFetch, csrfToken, errorText } from '@/lib/client';

export type AdminWeek = {
  id: string;
  number: number;
  title: string;
  summary: string | null;
  startsAt: string;
  endsAt: string;
  published: boolean;
  items: { id: string; kind: string; title: string; hasFile: boolean; url: string | null }[];
};

const KINDS = [
  { value: 'BUILD', label: 'Постройка' },
  { value: 'ART', label: 'Арт' },
  { value: 'VIDEO', label: 'Видео' },
  { value: 'LIFE', label: 'Жизнь сервера' },
  { value: 'POST', label: 'Завоз' },
];

export function AdminArchive({ weeks }: { weeks: AdminWeek[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [week, setWeek] = useState({
    number: (weeks[0]?.number ?? 0) + 1,
    title: '',
    summary: '',
    startsAt: '',
    endsAt: '',
  });

  const [item, setItem] = useState({
    weekId: weeks[0]?.id ?? '',
    kind: 'BUILD',
    title: '',
    description: '',
    url: '',
    authorNickname: '',
  });
  const [file, setFile] = useState<File | null>(null);

  async function run(action: () => Promise<unknown>, message: string) {
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

  function createWeek(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch('/api/admin/archive/weeks', {
        method: 'POST',
        body: JSON.stringify({
          number: week.number,
          title: week.title,
          summary: week.summary || null,
          startsAt: week.startsAt,
          endsAt: week.endsAt,
        }),
      });
      setWeek({ ...week, number: week.number + 1, title: '', summary: '' });
    }, 'Неделя создана');
  }

  function addItem(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (file) {
        const form = new FormData();
        form.set('weekId', item.weekId);
        form.set('kind', item.kind);
        form.set('title', item.title);
        if (item.description) form.set('description', item.description);
        if (item.url) form.set('url', item.url);
        if (item.authorNickname) form.set('authorNickname', item.authorNickname);
        form.append('file', file);

        const response = await fetch('/api/admin/archive/items', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken() },
          body: form,
          credentials: 'same-origin',
        });
        const data = (await response.json()) as { ok?: boolean; message?: string };
        if (!response.ok || !data.ok) throw new Error(data.message ?? 'Не удалось добавить');
      } else {
        await apiFetch('/api/admin/archive/items', {
          method: 'POST',
          body: JSON.stringify({
            weekId: item.weekId,
            kind: item.kind,
            title: item.title,
            description: item.description || null,
            url: item.url || null,
            authorNickname: item.authorNickname || null,
          }),
        });
      }
      setItem({ ...item, title: '', description: '', url: '' });
      setFile(null);
    }, 'Запись добавлена');
  }

  return (
    <>
      <form className={styles.form} onSubmit={createWeek}>
        <strong>Новая неделя</strong>
        <div className={styles.formRow}>
          <label className="field" style={{ width: 90 }}>
            <span className="field__label">Номер</span>
            <input
              className="input"
              type="number"
              min={0}
              value={week.number}
              onChange={(event) => setWeek({ ...week, number: Number(event.target.value) })}
              required
            />
          </label>
          <label className={`field ${styles.grow}`}>
            <span className="field__label">Название</span>
            <input
              className="input"
              value={week.title}
              onChange={(event) => setWeek({ ...week, title: event.target.value })}
              placeholder="Неделя 2"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Начало</span>
            <input
              className="input"
              type="date"
              value={week.startsAt}
              onChange={(event) => setWeek({ ...week, startsAt: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Конец</span>
            <input
              className="input"
              type="date"
              value={week.endsAt}
              onChange={(event) => setWeek({ ...week, endsAt: event.target.value })}
              required
            />
          </label>
          <button type="submit" className="btn btn--grass" disabled={busy}>
            Создать
          </button>
        </div>
        <label className="field">
          <span className="field__label">Описание недели</span>
          <input
            className="input"
            value={week.summary}
            onChange={(event) => setWeek({ ...week, summary: event.target.value })}
          />
        </label>
      </form>

      {weeks.length > 0 && (
        <form className={styles.form} onSubmit={addItem}>
          <strong>Добавить запись в неделю</strong>
          <div className={styles.formRow}>
            <label className="field">
              <span className="field__label">Неделя</span>
              <select
                className="select"
                value={item.weekId}
                onChange={(event) => setItem({ ...item, weekId: event.target.value })}
              >
                {weeks.map((row) => (
                  <option key={row.id} value={row.id}>
                    №{row.number}: {row.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Тип</span>
              <select
                className="select"
                value={item.kind}
                onChange={(event) => setItem({ ...item, kind: event.target.value })}
              >
                {KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`field ${styles.grow}`}>
              <span className="field__label">Название</span>
              <input
                className="input"
                value={item.title}
                onChange={(event) => setItem({ ...item, title: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Автор (ник)</span>
              <input
                className="input"
                value={item.authorNickname}
                onChange={(event) => setItem({ ...item, authorNickname: event.target.value })}
              />
            </label>
          </div>

          <div className={styles.formRow}>
            <label className={`field ${styles.grow}`}>
              <span className="field__label">Ссылка (для видео)</span>
              <input
                className="input"
                value={item.url}
                onChange={(event) => setItem({ ...item, url: event.target.value })}
                placeholder="https://youtu.be/..."
              />
            </label>
            <label className="field">
              <span className="field__label">Файл</span>
              <input
                className="input"
                type="file"
                accept="image/*,video/mp4,video/webm"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button type="submit" className="btn btn--grass" disabled={busy}>
              Добавить
            </button>
          </div>
          <span className="field__hint">Нужен файл или ссылка, можно и то и другое.</span>
        </form>
      )}

      {error && <p className="error-text">{error}</p>}
      {notice && <p className={styles.ok}>{notice}</p>}

      {weeks.map((row) => (
        <section key={row.id} style={{ marginBottom: 'var(--gap-lg)' }}>
          <div className="section-title">
            <h3>
              №{row.number}: {row.title}
            </h3>
            <button
              type="button"
              className={`btn btn--sm ${row.published ? 'btn--emerald' : 'btn--stone'}`}
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    apiFetch(`/api/admin/archive/weeks/${row.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ published: !row.published }),
                    }),
                  row.published ? 'Неделя снята с публикации' : 'Неделя опубликована',
                )
              }
            >
              {row.published ? 'Опубликована' : 'Черновик'}
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Удалить неделю №${row.number} вместе с записями?`)) return;
                void run(
                  () => apiFetch(`/api/admin/archive/weeks/${row.id}`, { method: 'DELETE' }),
                  'Неделя удалена',
                );
              }}
            >
              Удалить неделю
            </button>
          </div>

          {row.items.length > 0 ? (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <tbody>
                  {row.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>{KINDS.find((kind) => kind.value === entry.kind)?.label ?? entry.kind}</td>
                      <td>{entry.title}</td>
                      <td className="faint">
                        {entry.hasFile ? 'файл' : ''}
                        {entry.url ? ' ссылка' : ''}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                apiFetch(`/api/admin/archive/items/${entry.id}`, {
                                  method: 'DELETE',
                                }),
                              'Запись удалена',
                            )
                          }
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="faint">Записей нет.</p>
          )}
        </section>
      ))}
    </>
  );
}
