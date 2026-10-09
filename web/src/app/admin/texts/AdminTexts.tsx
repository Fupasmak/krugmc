'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import textStyles from './texts.module.css';
import { apiFetch, errorText } from '@/lib/client';
import { renderMarkup } from '@/lib/markup';
import { SITE_TEXTS, TEXT_GROUPS, TEXT_KEYS, type TextGroup, type TextKey } from '@/lib/site-texts';
import { AdminContent, type ContentEntry } from '../content/AdminContent';

const HELP = [
  ['*текст*', 'зелёный'],
  ['**текст**', 'жирный'],
  ['_текст_', 'курсив'],
  ['`текст`', 'пиксельный шрифт'],
  ['[текст](/posts)', 'ссылка'],
  ['{nick}', 'подстановка, только там, где она указана в подсказке'],
];

const GROUP_ORDER = Object.keys(TEXT_GROUPS) as TextGroup[];

const CONTENT_OF: Partial<Record<TextGroup, string>> = {
  about: 'about',
  zero: 'zero',
  join: 'join',
  corner: 'corner',
};

export function AdminTexts({
  texts,
  contentPages,
}: {
  texts: Record<string, string>;
  contentPages: ContentEntry[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(texts);
  const [group, setGroup] = useState<TextGroup>('home');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const changed = useMemo(
    () => TEXT_KEYS.filter((key) => (values[key] ?? '') !== (texts[key] ?? '')),
    [values, texts],
  );

  const byGroup = useMemo(() => {
    const map = new Map<TextGroup, TextKey[]>();
    for (const key of TEXT_KEYS) {
      const item = SITE_TEXTS[key].group;
      map.set(item, [...(map.get(item) ?? []), key]);
    }
    return map;
  }, []);

  const edited = useMemo(() => {
    const counts = new Map<TextGroup, number>();
    for (const key of TEXT_KEYS) {
      if ((texts[key] ?? '') !== SITE_TEXTS[key].value) {
        const item = SITE_TEXTS[key].group;
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }
    return counts;
  }, [texts]);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? TEXT_KEYS.filter((key) => {
        const entry = SITE_TEXTS[key];
        return [entry.label, entry.hint, values[key] ?? '', key, TEXT_GROUPS[entry.group]].some(
          (part) => part.toLowerCase().includes(needle),
        );
      })
    : (byGroup.get(group) ?? []);

  const contentSlug = needle ? undefined : CONTENT_OF[group];
  const contentPage = contentPages.find((page) => page.slug === contentSlug);

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = Object.fromEntries(changed.map((key) => [key, values[key] ?? '']));
      const result = await apiFetch<{ texts: Record<string, string> }>('/api/admin/texts', {
        method: 'PUT',
        body: JSON.stringify({ texts: payload }),
      });
      setValues(result.texts);
      setNotice('Сохранили. Тексты на сайте уже новые.');
      router.refresh();
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function reset(key: TextKey) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ texts: Record<string, string> }>('/api/admin/texts', {
        method: 'DELETE',
        body: JSON.stringify({ key }),
      });
      setValues(result.texts);
      setNotice(`Поле «${SITE_TEXTS[key].label}» вернули к исходному тексту.`);
      router.refresh();
    } catch (resetError) {
      setError(errorText(resetError));
    } finally {
      setBusy(false);
    }
  }

  const saveLabel = `Сохранить${changed.length > 0 ? ` (${changed.length})` : ''}`;

  return (
    <>
      <div className={textStyles.bar}>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти текст на любой странице"
          aria-label="Поиск по текстам"
        />
        <button type="button" className="btn btn--sm" onClick={() => setShowHelp((v) => !v)}>
          Как форматировать
        </button>
        <button
          type="button"
          className="btn btn--grass btn--sm"
          onClick={save}
          disabled={busy || changed.length === 0}
        >
          {saveLabel}
        </button>
      </div>

      {showHelp && (
        <div className={styles.form}>
          <strong>Мини-разметка</strong>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <tbody>
                {HELP.map(([code, what]) => (
                  <tr key={code}>
                    <td style={{ fontFamily: 'var(--font-pixel)' }}>{code}</td>
                    <td className="faint">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="field__hint">HTML-теги писать нельзя, они показываются как текст.</span>
        </div>
      )}

      <nav className={textStyles.pages} aria-label="Страницы сайта">
        {GROUP_ORDER.filter((item) => byGroup.has(item)).map((item) => {
          const count = edited.get(item) ?? 0;
          const active = !needle && item === group;
          return (
            <button
              key={item}
              type="button"
              className={`${textStyles.page} ${active ? textStyles.pageActive : ''}`}
              aria-pressed={active}
              onClick={() => {
                setGroup(item);
                setQuery('');
              }}
            >
              {TEXT_GROUPS[item]}
              {count > 0 && <span className={textStyles.badge}>{count}</span>}
            </button>
          );
        })}
      </nav>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className={styles.ok}>{notice}</p>}

      {needle && (
        <p className="faint">
          {visible.length > 0 ? `Нашли полей: ${visible.length}` : 'Ничего не нашли'}
        </p>
      )}

      {!needle && group === 'points' && (
        <div className={styles.form}>
          <strong>Суммы и правила начисления</strong>
          <span className="field__hint">
            Здесь тексты публичной страницы «Баллы», на ней нет ни одной цифры. Суммы, пресеты,
            сезон и начисления правятся в разделе баллов.
          </span>
          <div className={styles.formRow}>
            <Link href="/admin/points/presets" className="btn btn--sm">
              Пресеты и суммы
            </Link>
            <Link href="/admin/points" className="btn btn--ghost btn--sm">
              Баллы игроков
            </Link>
            <Link href="/points" className="btn btn--ghost btn--sm" target="_blank">
              Открыть страницу
            </Link>
          </div>
        </div>
      )}

      <div className="stack">
        {visible.map((key) => {
          const entry = SITE_TEXTS[key];
          const value = values[key] ?? '';
          const isDefault = value === entry.value;
          const isChanged = changed.includes(key);

          return (
            <div className={`${styles.form} ${isChanged ? textStyles.dirty : ''}`} key={key}>
              <label className="field">
                <span className="field__label">
                  {needle && <span className="faint">{TEXT_GROUPS[entry.group]} · </span>}
                  {entry.label}
                </span>
                {entry.multiline ? (
                  <textarea
                    className="textarea"
                    style={{ minHeight: 90 }}
                    value={value}
                    maxLength={entry.maxLength}
                    onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                  />
                ) : (
                  <input
                    className="input"
                    value={value}
                    maxLength={entry.maxLength}
                    onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                  />
                )}
                <span className="field__hint">
                  {entry.hint}. {value.length} из {entry.maxLength}
                </span>
              </label>

              <div>
                <span className="field__label">Предпросмотр</span>
                <div
                  className="panel panel--sunken"
                  style={{ padding: 'var(--gap-sm) var(--gap)' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkup(value) || '<span>пусто</span>' }}
                />
              </div>

              <div className={styles.formRow}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => reset(key)}
                  disabled={busy || isDefault}
                >
                  Вернуть по умолчанию
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {contentPage && (
        <section style={{ marginTop: 'var(--gap-lg)' }}>
          <div className="section-title">
            <h3>Основной текст страницы</h3>
          </div>
          <AdminContent key={contentPage.slug} pages={[contentPage]} />
        </section>
      )}

      {changed.length > 0 && (
        <div className={textStyles.floating}>
          <span>Несохранённых правок: {changed.length}</span>
          <button type="button" className="btn btn--grass btn--sm" onClick={save} disabled={busy}>
            {saveLabel}
          </button>
        </div>
      )}
    </>
  );
}
