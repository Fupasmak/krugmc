'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
};

type Options = {
  season: { title: string; closed: boolean };
  currentWeekId: string;
  players: { id: string; nickname: string }[];
  presets: Preset[];
  posts: { id: string; title: string; author: string }[];
  weeks: { id: string; number: number; closed: boolean }[];
};

type Preview = {
  weekNumber: number;
  kind: 'AWARD' | 'ADJUSTMENT';
  presetTitle: string | null;
  oncePerSeason: boolean;
  onceUsed: boolean;
  recipients: {
    userId: string;
    nickname: string;
    amount: number;
    inviter: { nickname: string; share: number } | null;
  }[];
};

export function AwardForm({
  options,
  initialPlayer,
}: {
  options: Options;
  initialPlayer: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    initialPlayer && options.players.some((player) => player.id === initialPlayer)
      ? [initialPlayer]
      : [],
  );
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PointCategoryKey>('EVENT');
  const [presetId, setPresetId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [comment, setComment] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [postId, setPostId] = useState('');
  const [weekId, setWeekId] = useState(options.currentWeekId);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmOnce, setConfirmOnce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const names = useMemo(
    () => new Map(options.players.map((player) => [player.id, player.nickname])),
    [options.players],
  );
  const presets = options.presets.filter((preset) => preset.category === category);
  const preset = presets.find((item) => item.id === presetId) ?? null;
  const isAdjustment = category === 'ADJUSTMENT';

  const suggestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return options.players
      .filter(
        (player) => !selected.includes(player.id) && player.nickname.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [options.players, search, selected]);

  function invalidate() {
    setPreview(null);
    setConfirmOnce(false);
    setDone(null);
  }

  function addPlayer(id: string) {
    setSelected((list) => (list.includes(id) ? list : [...list, id]));
    setSearch('');
    invalidate();
  }

  function pickPreset(id: string) {
    setPresetId(id);
    const next = presets.find((item) => item.id === id);
    if (next && next.amount !== null) setAmountText(formatPoints(next.amount));
    invalidate();
  }

  function body() {
    const amount = parsePoints(amountText);
    if (amount === null) throw new Error('Сумма: число, например 5 или 0,5');
    return {
      userIds: selected,
      category,
      presetId: presetId || null,
      amount,
      comment,
      proofUrl: proofUrl.trim() || null,
      postId: postId || null,
      weekId,
      confirmOncePerSeason: confirmOnce,
    };
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setBusy(false);
    }
  }

  function showPreview(event: React.FormEvent) {
    event.preventDefault();
    void run(async () => {
      const data = await apiFetch<Preview & { ok: boolean }>('/api/admin/points/entries/preview', {
        method: 'POST',
        body: JSON.stringify(body()),
      });
      setPreview(data);
    });
  }

  function save() {
    if (!preview) return;
    if (
      preview.oncePerSeason &&
      !window.confirm('Исторический завоз выдаётся один раз за сезон на весь сервер. Выдаём?')
    ) {
      return;
    }
    void run(async () => {
      const result = await apiFetch<{ ok: boolean; count: number }>('/api/admin/points/entries', {
        method: 'POST',
        body: JSON.stringify(body()),
      });
      setDone(`Начислено: ${result.count} ${result.count === 1 ? 'игроку' : 'игрокам'}`);
      setPreview(null);
      setSelected([]);
      setComment('');
      setProofUrl('');
      setPostId('');
      setConfirmOnce(false);
      router.refresh();
    });
  }

  if (options.season.closed) {
    return (
      <p className={styles.warn}>
        Сезон закрыт, начислять некуда. Новый сезон заводится на вкладке{' '}
        <Link href="/admin/points/season">Сезон</Link>.
      </p>
    );
  }

  return (
    <form className={styles.panel} onSubmit={showPreview}>
      <div className={`field ${styles.suggest}`}>
        <span className="field__label">Игроки: одному или сразу нескольким за одно событие</span>
        {selected.length > 0 && (
          <div className={styles.chips}>
            {selected.map((id) => (
              <span key={id} className={styles.chip}>
                {names.get(id)}
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`Убрать ${names.get(id)}`}
                  onClick={() => {
                    setSelected((list) => list.filter((item) => item !== id));
                    invalidate();
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          className="input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && suggestions[0]) {
              event.preventDefault();
              addPlayer(suggestions[0].id);
            }
          }}
          placeholder="Начни вводить ник"
          aria-autocomplete="list"
        />
        {suggestions.length > 0 && (
          <ul className={styles.suggestList} role="listbox">
            {suggestions.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  className={styles.suggestItem}
                  onClick={() => addPlayer(player.id)}
                >
                  {player.nickname}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.toolbar}>
        <label className="field">
          <span className="field__label">Категория</span>
          <select
            className="input"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as PointCategoryKey);
              setPresetId('');
              setAmountText('');
              invalidate();
            }}
          >
            {POINT_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        {!isAdjustment && (
          <label className="field" style={{ flex: 1, minWidth: 220 }}>
            <span className="field__label">Пресет</span>
            <select
              className="input"
              value={presetId}
              onChange={(event) => pickPreset(event.target.value)}
            >
              <option value="">Своя сумма</option>
              {presets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.amount === null ? 'по решению' : formatPoints(item.amount)}: {item.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field" style={{ width: 120 }}>
          <span className="field__label">Баллы</span>
          <input
            className="input"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => {
              setAmountText(event.target.value);
              invalidate();
            }}
            placeholder={isAdjustment ? '-5' : '5'}
          />
        </label>

        <label className="field">
          <span className="field__label">Неделя</span>
          <select
            className="input"
            value={weekId}
            onChange={(event) => {
              setWeekId(event.target.value);
              invalidate();
            }}
          >
            {options.weeks.map((week) => (
              <option key={week.id} value={week.id}>
                {week.number}
                {week.id === options.currentWeekId ? ' (текущая)' : week.closed ? ' (закрыта)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preset?.description && <p className={styles.meta}>{preset.description}</p>}
      <p className={styles.meta}>
        {isAdjustment
          ? 'Корректировка: можно в минус, шаг 0,5, комментарий обязателен. В резерв пригласившему не идёт.'
          : 'Своя сумма только кратная 5. Дробное бывает одно: 0,5 за шортс по пресету.'}
      </p>

      <label className="field">
        <span className="field__label">Комментарий, обязательно</span>
        <textarea
          className="input"
          rows={3}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            invalidate();
          }}
          placeholder="За что именно"
        />
      </label>

      <div className={styles.toolbar}>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          <span className="field__label">Ссылка-доказательство</span>
          <input
            className="input"
            value={proofUrl}
            onChange={(event) => {
              setProofUrl(event.target.value);
              invalidate();
            }}
            placeholder="https://"
          />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          <span className="field__label">Завоз с сайта</span>
          <select
            className="input"
            value={postId}
            onChange={(event) => {
              setPostId(event.target.value);
              invalidate();
            }}
          >
            <option value="">Без завоза</option>
            {options.posts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title} ({post.author})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {done && <p className={styles.plus}>{done}</p>}

      {preview && (
        <div className={styles.preview} aria-live="polite">
          <strong>
            Предпросмотр: неделя {preview.weekNumber}
            {preview.presetTitle ? `, ${preview.presetTitle}` : ''}
          </strong>
          {preview.recipients.map((recipient) => (
            <div key={recipient.userId}>
              <div className={styles.previewRow}>
                <span>{recipient.nickname}</span>
                <span
                  className={`${styles.num} ${recipient.amount < 0 ? styles.minus : styles.plus}`}
                >
                  {formatPoints(recipient.amount, true)}
                </span>
              </div>
              {recipient.inviter && (
                <div className={`${styles.previewRow} ${styles.meta}`}>
                  <span>в резерв пригласившему {recipient.inviter.nickname}</span>
                  <span className={styles.num}>{formatPoints(recipient.inviter.share, true)}</span>
                </div>
              )}
            </div>
          ))}

          {preview.oncePerSeason && preview.onceUsed && (
            <p className={styles.warn}>
              Исторический завоз в этом сезоне уже выдан. Второй раз нельзя.
            </p>
          )}
          {preview.oncePerSeason && !preview.onceUsed && (
            <label className={styles.inline}>
              <input
                type="checkbox"
                checked={confirmOnce}
                onChange={(event) => setConfirmOnce(event.target.checked)}
              />
              Да, это исторический завоз, он бывает один раз за сезон
            </label>
          )}
        </div>
      )}

      <div className={styles.inline}>
        <button type="submit" className="btn" disabled={busy || selected.length === 0}>
          Предпросмотр
        </button>
        <button
          type="button"
          className="btn btn--grass"
          disabled={
            busy || !preview || (preview.oncePerSeason && (preview.onceUsed || !confirmOnce))
          }
          onClick={save}
        >
          Начислить
        </button>
      </div>
    </form>
  );
}
