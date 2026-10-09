'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import { SkinHead } from '@/components/SkinHead';
import { apiFetch, csrfToken, errorText } from '@/lib/client';

export type AdminPlayer = {
  id: string;
  nickname: string;
  slug: string;
  uuid: string | null;
  cardFile: string | null;
  hidden: boolean;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  firstLoginAt: string | null;
  posts: number;
};

export function AdminPlayers({
  players,
  superadmin,
}: {
  players: AdminPlayer[];
  superadmin: boolean;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [wikiText, setWikiText] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function run(action: () => Promise<unknown>, message?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (message) setNotice(message);
      router.refresh();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  }

  function addPlayer(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch('/api/admin/players', {
        method: 'POST',
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      setNickname('');
    }, 'Игрок добавлен');
  }

  function uploadCard(player: AdminPlayer, file: File) {
    void run(async () => {
      const form = new FormData();
      form.append('card', file);
      const response = await fetch(`/api/admin/players/${player.id}/card`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken() },
        body: form,
        credentials: 'same-origin',
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message ?? 'Не удалось загрузить карточку');
    }, 'Карточка обновлена');
  }

  function saveWiki(player: AdminPlayer) {
    void run(async () => {
      await apiFetch(`/api/admin/players/${player.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ wikiText: wikiText.trim() || null }),
      });
      setEditing(null);
    }, 'Текст сохранён');
  }

  return (
    <>
      <form className={styles.form} onSubmit={addPlayer}>
        <strong>Добавить игрока, который ещё не заходил</strong>
        <div className={styles.formRow}>
          <label className={`field ${styles.grow}`}>
            <span className="field__label">Ник в Minecraft</span>
            <input
              className="input"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Fupasmak"
              required
            />
          </label>
          <button type="submit" className="btn btn--grass" disabled={busy}>
            Добавить
          </button>
        </div>
        <span className="field__hint">
          Когда человек впервые войдёт через Minecraft, запись подхватится по нику -
          карточка и текст останутся.
        </span>
      </form>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className={styles.ok}>{notice}</p>}

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Заходил</th>
              <th>Завозов</th>
              <th>Карточка</th>
              <th>Роль</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SkinHead name={player.slug} size={22} />
                    {player.nickname}
                    {player.hidden && <span className="tag">скрыт</span>}
                  </span>
                </td>
                <td className="faint">
                  {player.firstLoginAt
                    ? new Date(player.firstLoginAt).toLocaleDateString('ru-RU')
                    : 'нет'}
                </td>
                <td>{player.posts}</td>
                <td>
                  <div className={styles.actions}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      ref={(element) => {
                        fileRefs.current[player.id] = element;
                      }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadCard(player, file);
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--stone btn--sm"
                      onClick={() => fileRefs.current[player.id]?.click()}
                      disabled={busy}
                    >
                      {player.cardFile ? 'Заменить' : 'Загрузить'}
                    </button>
                    {player.cardFile && (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              apiFetch(`/api/admin/players/${player.id}/card`, { method: 'DELETE' }),
                            'Карточка удалена',
                          )
                        }
                      >
                        Убрать
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  {player.role === 'SUPERADMIN' ? (
                    <span className="tag">главный</span>
                  ) : superadmin ? (
                    <button
                      type="button"
                      className={`btn btn--sm ${player.role === 'ADMIN' ? 'btn--gold' : 'btn--stone'}`}
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            apiFetch(`/api/admin/players/${player.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                role: player.role === 'ADMIN' ? 'USER' : 'ADMIN',
                              }),
                            }),
                          'Роль изменена',
                        )
                      }
                    >
                      {player.role === 'ADMIN' ? 'админ' : 'игрок'}
                    </button>
                  ) : (
                    <span className="faint">{player.role === 'ADMIN' ? 'админ' : 'игрок'}</span>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn--stone btn--sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            apiFetch(`/api/admin/players/${player.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ hidden: !player.hidden }),
                            }),
                          player.hidden ? 'Игрок показан' : 'Игрок скрыт',
                        )
                      }
                    >
                      {player.hidden ? 'Показать' : 'Скрыть'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--stone btn--sm"
                      onClick={() => {
                        setEditing(editing === player.id ? null : player.id);
                        setWikiText('');
                      }}
                    >
                      Текст
                    </button>
                    {!player.firstLoginAt && player.posts === 0 && (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Удалить запись игрока ${player.nickname}?`)) return;
                          void run(
                            () => apiFetch(`/api/admin/players/${player.id}`, { method: 'DELETE' }),
                            'Запись удалена',
                          );
                        }}
                      >
                        Удалить
                      </button>
                    )}
                  </div>

                  {editing === player.id && (
                    <div className="stack" style={{ marginTop: 8 }}>
                      <textarea
                        className="textarea"
                        style={{ minHeight: 120 }}
                        value={wikiText}
                        onChange={(event) => setWikiText(event.target.value)}
                        placeholder="Текст о игроке (Markdown). Пусто, убрать текст."
                      />
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className="btn btn--grass btn--sm"
                          disabled={busy}
                          onClick={() => saveWiki(player)}
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setEditing(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
