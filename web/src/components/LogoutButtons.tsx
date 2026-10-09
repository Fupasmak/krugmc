'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, errorText } from '@/lib/client';
import { useTexts } from './TextsProvider';

export function LogoutButtons() {
  const t = useTexts();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout(everywhere: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(everywhere ? '/api/auth/logout-all' : '/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (logoutError) {
      setError(errorText(logoutError));
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn--stone btn--sm"
          onClick={() => logout(false)}
          disabled={busy}
        >
          {t('me.logout')}
        </button>
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={() => logout(true)}
          disabled={busy}
        >
          {t('me.logoutAll')}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
