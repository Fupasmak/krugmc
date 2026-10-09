'use client';

import { useState } from 'react';
import styles from '../admin.module.css';
import { apiFetch, errorText } from '@/lib/client';

export type ContentEntry = { slug: string; title: string; body: string };

export function AdminContent({ pages }: { pages: ContentEntry[] }) {
  const [active, setActive] = useState(pages[0]?.slug ?? '');
  const [bodies, setBodies] = useState<Record<string, string>>(
    Object.fromEntries(pages.map((page) => [page.slug, page.body])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const page = pages.find((item) => item.slug === active);

  async function save() {
    if (!page) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/content/${page.slug}`, {
        method: 'PUT',
        body: JSON.stringify({ body: bodies[page.slug] ?? '' }),
      });
      setNotice('Текст сохранён. Страница обновится сразу.');
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!page) return;
    if (!confirm('Вернуть текст из файла в репозитории? Правки из админки пропадут.')) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ body: string }>(`/api/admin/content/${page.slug}`, {
        method: 'DELETE',
      });
      setBodies({ ...bodies, [page.slug]: result.body });
      setNotice('Вернули текст из файла.');
    } catch (resetError) {
      setError(errorText(resetError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {pages.length > 1 && (
        <div className={styles.formRow} style={{ marginBottom: 'var(--gap)' }}>
          {pages.map((item) => (
            <button
              key={item.slug}
              type="button"
              className={`btn btn--sm ${item.slug === active ? 'btn--emerald' : 'btn--stone'}`}
              onClick={() => setActive(item.slug)}
            >
              {item.title}
            </button>
          ))}
        </div>
      )}

      {page && (
        <div className={styles.form}>
          <label className="field">
            <span className="field__label">{page.title}, Markdown</span>
            <textarea
              className="textarea"
              style={{ minHeight: 460, fontFamily: 'var(--font-pixel)', fontSize: 13 }}
              value={bodies[page.slug] ?? ''}
              onChange={(event) => setBodies({ ...bodies, [page.slug]: event.target.value })}
            />
            <span className="field__hint">
              Заголовки уровня «##» попадают в оглавление страницы.
            </span>
          </label>

          {error && <p className="error-text">{error}</p>}
          {notice && <p className={styles.ok}>{notice}</p>}

          <div className={styles.formRow}>
            <button type="button" className="btn btn--grass" onClick={save} disabled={busy}>
              Сохранить
            </button>
            <button type="button" className="btn btn--stone" onClick={reset} disabled={busy}>
              Вернуть текст из файла
            </button>
          </div>
        </div>
      )}
    </>
  );
}
