'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../points.module.css';
import { apiFetch, errorText } from '@/lib/client';
import {
  CATEGORY_LABELS,
  POINT_CATEGORIES,
  formatPoints,
  parsePoints,
  type PointCategoryKey,
} from '@/lib/points';

type Preset = {
  id: string;
  category: PointCategoryKey;
  title: string;
  description: string | null;
  amount: number | null;
  oncePerSeason: boolean;
  active: boolean;
  order: number;
};

type Draft = {
  category: PointCategoryKey;
  title: string;
  description: string;
  amount: string;
  oncePerSeason: boolean;
  active: boolean;
  order: string;
};

const CATEGORIES = POINT_CATEGORIES.filter((key) => key !== 'ADJUSTMENT');

function toDraft(preset?: Preset): Draft {
  return {
    category: preset?.category ?? 'EVENT',
    title: preset?.title ?? '',
    description: preset?.description ?? '',
    amount: preset?.amount === null || preset?.amount === undefined ? '' : formatPoints(preset.amount),
    oncePerSeason: preset?.oncePerSeason ?? false,
    active: preset?.active ?? true,
    order: String(preset?.order ?? 0),
  };
}

function PresetForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (draft: Draft) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (submitError) {
      setError(errorText(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.panel} onSubmit={submit}>
      <div className={styles.toolbar}>
        <label className="field">
          <span className="field__label">Категория</span>
          <select
            className="input"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value as PointCategoryKey })}
          >
            {CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span className="field__label">Название</span>
          <input
            className="input"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label className="field" style={{ width: 110 }}>
          <span className="field__label">Баллы</span>
          <input
            className="input"
            inputMode="decimal"
            value={draft.amount}
            placeholder="по решению"
            onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
          />
        </label>
        <label className="field" style={{ width: 90 }}>
          <span className="field__label">Порядок</span>
          <input
            className="input"
            inputMode="numeric"
            value={draft.order}
            onChange={(event) => setDraft({ ...draft, order: event.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span className="field__label">Описание</span>
        <input
          className="input"
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </label>
      <div className={styles.inline}>
        <label className={styles.inline}>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />
          Активен
        </label>
        <label className={styles.inline}>
          <input
            type="checkbox"
            checked={draft.oncePerSeason}
            onChange={(event) => setDraft({ ...draft, oncePerSeason: event.target.checked })}
          />
          Один раз за сезон
        </label>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className={styles.inline}>
        <button type="submit" className="btn btn--grass btn--sm" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}

function payload(draft: Draft) {
  const amount = draft.amount.trim() ? parsePoints(draft.amount) : null;
  if (draft.amount.trim() && amount === null) throw new Error('Баллы: число или пусто');
  return {
    category: draft.category,
    title: draft.title,
    description: draft.description || null,
    amount,
    oncePerSeason: draft.oncePerSeason,
    active: draft.active,
    order: Number(draft.order) || 0,
  };
}

export function PresetsEditor({ presets, canEdit }: { presets: Preset[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function create(draft: Draft) {
    await apiFetch('/api/admin/points/presets', { method: 'POST', body: JSON.stringify(payload(draft)) });
    setAdding(false);
    router.refresh();
  }

  async function update(id: string, draft: Draft) {
    await apiFetch(`/api/admin/points/presets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload(draft)),
    });
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <p className={styles.meta}>
        {canEdit
          ? 'Сумма кратна 5, либо 0,5, либо пусто: тогда сумму решают при начислении. Выключенный пресет пропадает из формы, история остаётся.'
          : 'Пресеты правит главный администратор.'}
      </p>

      {canEdit &&
        (adding ? (
          <PresetForm
            initial={toDraft()}
            submitLabel="Добавить"
            onSubmit={create}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            className="btn btn--sm"
            style={{ marginBottom: 'var(--gap)' }}
            onClick={() => setAdding(true)}
          >
            Новый пресет
          </button>
        ))}

      {CATEGORIES.map((category) => {
        const list = presets.filter((preset) => preset.category === category);
        if (list.length === 0) return null;
        return (
          <section key={category}>
            <h3 className={styles.panelTitle}>{CATEGORY_LABELS[category]}</h3>
            <ul className={styles.entryList}>
              {list.map((preset) =>
                editing === preset.id ? (
                  <li key={preset.id}>
                    <PresetForm
                      initial={toDraft(preset)}
                      submitLabel="Сохранить"
                      onSubmit={(draft) => update(preset.id, draft)}
                      onCancel={() => setEditing(null)}
                    />
                  </li>
                ) : (
                  <li
                    key={preset.id}
                    className={styles.entryItem}
                    style={preset.active ? undefined : { opacity: 0.5 }}
                  >
                    <span>
                      <strong>{preset.title}</strong>
                      {preset.oncePerSeason && <span className={styles.meta}>, раз за сезон</span>}
                      {!preset.active && <span className={styles.meta}>, выключен</span>}
                    </span>
                    <span className={`${styles.num} ${styles.plus}`}>
                      {preset.amount === null ? 'по решению' : formatPoints(preset.amount)}
                    </span>
                    {(preset.description || canEdit) && (
                      <span className={styles.entryComment}>
                        {preset.description}
                        {canEdit && (
                          <>
                            {' '}
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => setEditing(preset.id)}
                            >
                              Править
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}
    </>
  );
}
