'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from './ProfileMenu.module.css';
import { SkinHead } from './SkinHead';
import { useTexts } from './TextsProvider';
import { apiFetch, errorText } from '@/lib/client';

export type ProfileUser = {
  type: 'MC' | 'TG';
  nickname: string | null;
  slug: string | null;
  tgName: string | null;
  tgPhoto: string | null;
  admin: boolean;
};

export function ProfileMenu({ user }: { user: ProfileUser }) {
  const t = useTexts();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const label = user.type === 'MC' ? (user.nickname ?? 'Игрок') : (user.tgName ?? 'Зритель');

  async function logout(everywhere: boolean) {
    setBusy(true);
    try {
      await apiFetch(everywhere ? '/api/auth/logout-all' : '/api/auth/logout', { method: 'POST' });
      setOpen(false);
      router.push('/');
      router.refresh();
    } catch (error) {
      alert(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user.type === 'MC' ? (
          <SkinHead name={user.slug ?? user.nickname} size={28} />
        ) : user.tgPhoto ? (
          <img className={styles.avatar} src={user.tgPhoto} alt="" width={28} height={28} />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className={styles.name}>{label}</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <span className={styles.role}>
            {user.type === 'MC' ? t('nav.profile.player') : t('nav.profile.viewer')}
          </span>

          {user.type === 'MC' && (
            <>
              <Link className={styles.item} href="/me" role="menuitem" onClick={() => setOpen(false)}>
                {t('nav.profile.me')}
              </Link>
              {user.slug && (
                <Link
                  className={styles.item}
                  href={`/players/${user.slug}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {t('nav.profile.page')}
                </Link>
              )}
            </>
          )}

          {user.admin && (
            <Link className={styles.item} href="/admin" role="menuitem" onClick={() => setOpen(false)}>
              {t('nav.profile.admin')}
            </Link>
          )}

          <button
            type="button"
            className={`${styles.item} ${styles.itemDanger}`}
            role="menuitem"
            disabled={busy}
            onClick={() => logout(false)}
          >
            {t('nav.profile.logout')}
          </button>
          <button
            type="button"
            className={`${styles.item} ${styles.itemDanger}`}
            role="menuitem"
            disabled={busy}
            onClick={() => logout(true)}
          >
            {t('nav.profile.logoutAll')}
          </button>
        </div>
      )}
    </div>
  );
}
