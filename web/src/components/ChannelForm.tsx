'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { apiFetch, errorText } from '@/lib/client';
import { TextMarkup, useTexts } from './TextsProvider';

/**
 * Свой публичный Telegram-канал в кабинете игрока.
 * Принимаем ссылку в любом виде, на сервере остаётся только имя.
 */
export function ChannelForm({ channel }: { channel: string | null }) {
  const router = useRouter();
  const t = useTexts();
  const [value, setValue] = useState(channel ? `t.me/${channel}` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const result = await apiFetch<{ channel: string }>('/api/me/channel', {
        method: 'PUT',
        body: JSON.stringify({ channel: value }),
      });
      setSaved(t('me.channel.saved', { channel: result.channel }));
      router.refresh();
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await apiFetch('/api/me/channel', { method: 'DELETE' });
      setValue('');
      setSaved(t('me.channel.removed'));
      router.refresh();
    } catch (removeError) {
      setError(errorText(removeError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <TextMarkup
        as="p"
        className="muted"
        value={
          channel
            ? t('me.channel.has', { channel: `[@${channel}](https://t.me/${channel})` })
            : t('me.channel.none')
        }
      />

      <label className="field">
        <span className="field__label">{t('me.channel.label')}</span>
        <input
          className="input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="t.me/serverKRUG"
          aria-label="Ссылка на твой Telegram-канал"
        />
        <span className="field__hint">
          {t('me.channel.hint')}
        </span>
      </label>

      <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
        <Button type="submit" size="sm" disabled={busy || !value.trim()}>
          {t('me.channel.save')}
        </Button>
        {channel && (
          <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
            {t('me.channel.remove')}
          </Button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {saved && <p style={{ color: 'var(--phosphor)', fontSize: 'var(--text-sm)' }}>{saved}</p>}
    </form>
  );
}
