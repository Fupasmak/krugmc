'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import { apiFetch, errorText } from '@/lib/client';

export type AdminArticle = {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  published: boolean;
  updatedAt: string;
};

const EMPTY = { slug: '', title: '', category: 'Общее', body: '', published: true };

export function AdminWiki({ articles }: { articles: AdminArticle[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<typeof EMPTY & { id?: string }>(EMPTY);
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

  function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      slug: draft.slug,
      title: draft.title,
      category: draft.category,
      body: draft.body,
      published: draft.published,
    };

    void run(async () => {
      if (draft.id) {
        await apiFetch(`/api/admin/wiki/${draft.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/wiki', { method: 'POST', body: JSON.stringify(payload) });
      }
      setDraft(EMPTY);
    }, draft.id ? 'Статья сохранена' : 'Статья создана');
  }

  return (
    <>
      <form className={styles.form} onSubmit={save}>
        <strong>{draft.id ? `Правка: ${draft.title}` : 'Новая статья'}</strong>
        <div className={styles.formRow}>
          <label className={`field ${styles.grow}`}>
            <span className="field__label">Заголовок</span>
            <input
              className="input"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Адрес (латиницей)</span>
            <input
              className="input"
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              placeholder="zero-rules"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Раздел</span>
            <input
              className="input"
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Текст (Markdown)</span>
          <textarea
            className="textarea"
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          />
        </label>

        <div className={styles.formRow}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) => setDraft({ ...draft, published: event.target.checked })}
            />
            <span className="field__label" style={{ margin: 0 }}>
              Опубликована
            </span>
          </label>
          <button type="submit" className="btn btn--grass" disabled={busy}>
            {draft.id ? 'Сохранить' : 'Создать'}
          </button>
          {draft.id && (
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(EMPTY)}>
              Новая статья
            </button>
          )}
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className={styles.ok}>{notice}</p>}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Статья</th>
              <th>Раздел</th>
              <th>Адрес</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td>{article.title}</td>
                <td className="faint">{article.category}</td>
                <td className="faint">/wiki/{article.slug}</td>
                <td>{article.published ? 'опубликована' : 'черновик'}</td>
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn--stone btn--sm"
                      onClick={() =>
                        setDraft({
                          id: article.id,
                          slug: article.slug,
                          title: article.title,
                          category: article.category,
                          body: article.body,
                          published: article.published,
                        })
                      }
                    >
                      Править
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(`Удалить статью «${article.title}»?`)) return;
                        void run(
                          () => apiFetch(`/api/admin/wiki/${article.id}`, { method: 'DELETE' }),
                          'Статья удалена',
                        );
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
