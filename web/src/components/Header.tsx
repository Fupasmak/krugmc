import Link from 'next/link';
import styles from './Header.module.css';
import { currentUser, isAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { env, publicEnv } from '@/lib/env';
import { ProfileMenu } from './ProfileMenu';
import { MobileNav } from './MobileNav';
import { ComposerButton } from './ComposerButton';
import { HeaderShell } from './HeaderShell';
import { HeaderNav, type NavItem } from './HeaderNav';
import { BlockButton } from './BlockButton';
import { Logo } from './Logo';
import { getTexts } from '@/server/texts';
import type { SiteTexts } from '@/lib/site-texts';

type MapState = 'ready' | 'unset' | 'hidden';

/** Основные пункты остаются в строке, редкие уезжают в меню «Ещё». */
function navItems(map: MapState, t: SiteTexts): { main: NavItem[]; more: NavItem[] } {
  const mapItem: NavItem[] =
    map === 'ready'
      ? [{ href: '/map', label: t['nav.map'] }]
      : map === 'unset'
        ? [{ href: '/map', label: t['nav.map'], note: 'не настроено' }]
        : [];

  const main: NavItem[] = [
    { href: '/posts', label: t['nav.posts'] },
    { href: '/players', label: t['nav.players'] },
    ...mapItem,
    { href: '/zero', label: t['nav.zero'] },
    { href: '/about', label: t['nav.about'] },
    { href: '/join', label: t['nav.join'] },
  ];

  const more: NavItem[] = [
    { href: '/archive', label: t['nav.archive'] },
    { href: '/media', label: t['nav.media'] },
    { href: '/wiki', label: t['nav.wiki'] },
    { href: '/points', label: t['nav.points'] },
  ];

  if (env.FEATURE_CORNER) more.push({ href: '/corner', label: t['nav.corner'] });
  if (env.FEATURE_TEAM) more.push({ href: '/team', label: t['nav.team'] });

  return { main, more };
}

export async function Header() {
  const [user, settings, texts] = await Promise.all([currentUser(), getSettings(), getTexts()]);
  const admin = isAdmin(user);
  const mapReady =
    Boolean(process.env.MAP_UPSTREAM_URL) || (settings.mapEnabled && settings.mapUrl.trim().length > 0);
  const { main, more } = navItems(mapReady ? 'ready' : admin ? 'unset' : 'hidden', texts);
  const isPlayer = user?.type === 'MC';

  return (
    <HeaderShell>
      <Link href="/" className={styles.logo} aria-label="KRUG, на главную">
        <Logo size={30} hideWordOnPhone />
      </Link>

      <HeaderNav main={main} more={more} />

      <div className={styles.right}>
        {isPlayer && <ComposerButton />}
        {user ? (
          <ProfileMenu
            user={{
              type: user.type,
              nickname: user.mcNickname,
              slug: user.mcNicknameLower,
              tgName: user.tgFirstName ?? user.tgUsername,
              tgPhoto: user.tgPhotoUrl,
              admin,
            }}
          />
        ) : (
          <BlockButton href="/login" variant="grass" size="sm">
            {texts['nav.login']}
          </BlockButton>
        )}
        <MobileNav
          items={[...main, ...more]}
          isPlayer={isPlayer}
          loggedIn={Boolean(user)}
          telegramUrl={publicEnv.telegramUrl}
          discordUrl={publicEnv.discordUrl}
        />
      </div>
    </HeaderShell>
  );
}
