'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import { apiFetch, errorText } from '@/lib/client';

export type AdminMediaItem = {
  id: string;
  title: string;
  url: string;
  author: string | null;
  week: number | null;
  publishedAt: string;
};

export function AdminMedia({ items }: { items: AdminMediaItem[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    url: '',
    description: '',
    authorNickname: '',
    weekNumber: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  function add(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch('/api/admin/media', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          url: form.url,
          description: form.description || null,
          authorNickname: form.authorNickname || null,
          weekNumber: form.weekNumber ? Number(form.weekNumber) : null,
        }),
      });
      setForm({ title: '', url: '', description: '', authorNickname: '', weekNumber: '' });
    }, 'Видео добавлено');
  }

  return (
    <>
      <form className={styles.form} onSubmit={add}>
        <strong>Добавить видео</strong>
        <div className={styles.formRow}>
          <label className={`field ${styles.grow}`}>
            <span className="field__label">Название</span>
            <input
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
          </label>
          <label className={`field ${styles.grow}`}>
            <span className="field__label">Ссылка</span>
            <input
              className="input"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="https://youtu.be/..."
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Автор</span>
            <input
              className="input"
              value={form.authorNickname}
              onChange={(event) => setForm({ ...form, authorNickname: event.target.value })}
            />
          </label>
          <label className="field" style={{ width: 110 }}>
            <span className="field__label">Неделя</span>
            <input
              className="input"
              type="number"
              min={0}
              value={form.weekNumber}
              onChange={(event) => setForm({ ...form, weekNumber: event.target.value })}
            />
          </label>
          <button type="submit" className="btn btn--grass" disabled={busy}>
            Добавить
          </button>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className={styles.ok}>{notice}</p>}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Название</th>
              <th>Автор</th>
              <th>Неделя</th>
              <th>Дата</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                </td>
                <td>{item.author ?? '-'}</td>
                <td>{item.week ?? '-'}</td>
                <td className="faint">{new Date(item.publishedAt).toLocaleDateString('ru-RU')}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => apiFetch(`/api/admin/media/${item.id}`, { method: 'DELETE' }),
                        'Видео удалено',
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
    </>
  );
}
