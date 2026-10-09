'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import { apiFetch, errorText } from '@/lib/client';

export type AdminPost = {
  id: string;
  title: string;
  author: string;
  tag: 'STREAM' | 'OFFSTREAM';
  score: number;
  createdAt: string;
  pinned: boolean;
  deleted: boolean;
};

export function AdminPosts({ posts }: { posts: AdminPost[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <p className="error-text">{error}</p>}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Завоз</th>
              <th>Автор</th>
              <th>Метка</th>
              <th>Счёт</th>
              <th>Дата</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} style={post.deleted ? { opacity: 0.55 } : undefined}>
                <td>
                  <Link href={`/posts/${post.id}`}>{post.title}</Link>
                  {post.pinned && <span className="tag">закреплён</span>}
                  {post.deleted && <span className="tag">удалён</span>}
                </td>
                <td>{post.author}</td>
                <td className="faint">{post.tag === 'STREAM' ? 'На стриме' : 'Вне стрима'}</td>
                <td>{post.score}</td>
                <td className="faint">{new Date(post.createdAt).toLocaleDateString('ru-RU')}</td>
                <td>
                  <div className={styles.actions}>
                    {!post.deleted && (
                      <button
                        type="button"
                        className={`btn btn--sm ${post.pinned ? 'btn--gold' : 'btn--stone'}`}
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            apiFetch(`/api/admin/posts/${post.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ pinned: !post.pinned }),
                            }),
                          )
                        }
                      >
                        {post.pinned ? 'Открепить' : 'Закрепить'}
                      </button>
                    )}
                    {post.deleted ? (
                      <button
                        type="button"
                        className="btn btn--grass btn--sm"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            apiFetch(`/api/admin/posts/${post.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ restore: true }),
                            }),
                          )
                        }
                      >
                        Вернуть
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Удалить завоз «${post.title}»?`)) return;
                          void run(() => apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' }));
                        }}
                      >
                        Удалить
                      </button>
                    )}
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
