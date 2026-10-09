'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import { apiFetch, errorText } from '@/lib/client';
import { PROJECT_STATUSES, type SiteSettings } from '@/lib/site-settings';

export function AdminSettings({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(form) });
      setSaved(true);
      router.refresh();
    } catch (submitError) {
      setError(errorText(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className="field">
        <span className="field__label">Статус проекта</span>
        <select
          className="select"
          value={form.projectStatus}
          onChange={(event) =>
            setForm({ ...form, projectStatus: event.target.value as SiteSettings['projectStatus'] })
          }
        >
          {Object.entries(PROJECT_STATUSES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Заметка к статусу</span>
        <input
          className="input"
          value={form.projectStatusNote}
          maxLength={200}
          onChange={(event) => setForm({ ...form, projectStatusNote: event.target.value })}
          placeholder="Например: Отбор идёт до конца недели"
        />
      </label>

      <label className="field">
        <span className="field__label">Ссылка на трейлер</span>
        <input
          className="input"
          value={form.trailerUrl}
          onChange={(event) => setForm({ ...form, trailerUrl: event.target.value })}
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <span className="field__hint">YouTube или VK Видео. Пусто, блок трейлера скрыт.</span>
      </label>

      <label className="field">
        <span className="field__label">Подпись к трейлеру</span>
        <input
          className="input"
          value={form.trailerTitle}
          maxLength={160}
          onChange={(event) => setForm({ ...form, trailerTitle: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Слоган в шапке главной</span>
        <input
          className="input"
          value={form.heroTagline}
          maxLength={160}
          onChange={(event) => setForm({ ...form, heroTagline: event.target.value })}
        />
      </label>

      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={form.joinOpen}
          onChange={(event) => setForm({ ...form, joinOpen: event.target.checked })}
        />
        <span className="field__label" style={{ margin: 0 }}>
          Набор открыт
        </span>
      </label>

      <label className="field">
        <span className="field__label">Ссылка на карту сервера</span>
        <input
          className="input"
          value={form.mapUrl}
          onChange={(event) => setForm({ ...form, mapUrl: event.target.value })}
          placeholder="https://map.krugmc.ru"
        />
        <span className="field__hint">
          BlueMap, Dynmap или Pl3xMap. Только https. Пусто означает заглушку на странице
          и скрытый пункт меню.
        </span>
      </label>

      <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={form.mapEnabled}
          onChange={(event) => setForm({ ...form, mapEnabled: event.target.checked })}
        />
        <span className="field__label" style={{ margin: 0 }}>
          Показывать вкладку «Карта»
        </span>
      </label>

      <label className="field">
        <span className="field__label">Адрес сервера</span>
        <input
          className="input"
          value={form.serverAddress}
          onChange={(event) => setForm({ ...form, serverAddress: event.target.value })}
          placeholder="play.example.ru:25565"
        />
        <span className="field__hint">
          Лежит только здесь: ни на одной странице сайта адрес не показывается. Тот же
          адрес пропиши в config.yml плагина, в поле server.address.
        </span>
      </label>

      {error && <p className="error-text">{error}</p>}
      {saved && <p className={styles.ok}>Сохранено.</p>}

      <div>
        <button type="submit" className="btn btn--grass" disabled={busy}>
          Сохранить
        </button>
      </div>
    </form>
  );
}
