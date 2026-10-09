'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, errorText } from '@/lib/client';
import { useTexts } from './TextsProvider';

/** Кнопки автора завоза: правка и удаление. Удаление подтверждается. */
export function PostActions({ postId }: { postId: string }) {
  const t = useTexts();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      router.push('/posts');
      router.refresh();
    } catch (error) {
      alert(errorText(error));
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <>
        <button type="button" className="btn btn--danger btn--sm" onClick={remove} disabled={busy}>
          {t('post.deleteConfirm')}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setConfirming(false)}
          disabled={busy}
        >
          {t('post.cancel')}
        </button>
      </>
    );
  }

  return (
    <>
      <Link href={`/posts/${postId}/edit`} className="btn btn--stone btn--sm">
        {t('post.edit')}
      </Link>
      <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirming(true)}>
        {t('post.delete')}
      </button>
    </>
  );
}
