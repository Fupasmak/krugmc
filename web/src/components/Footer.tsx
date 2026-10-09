import Link from 'next/link';
import styles from './Footer.module.css';
import { PixelIcon } from './PixelIcon';
import { publicEnv, env } from '@/lib/env';
import { getTexts } from '@/server/texts';
import { Logo } from './Logo';
import { SiteTextView } from './SiteTextView';

export async function Footer() {
  const year = new Date().getFullYear();
  const texts = await getTexts();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <Logo className={styles.wordmark} size={26} />
            <SiteTextView className={styles.tagline} value={texts['footer.tagline']} />
            <SiteTextView className="faint" value={texts['footer.version']} />
          </div>

          <div className={styles.columns}>
            <nav className={styles.column} aria-label={texts['nav.footer.sections']}>
              <span className={styles.columnTitle}>{texts['nav.footer.sections']}</span>
              <Link href="/posts">{texts['nav.posts']}</Link>
              <Link href="/players">{texts['nav.players']}</Link>
              <Link href="/archive">{texts['nav.archive']}</Link>
              <Link href="/media">{texts['nav.media']}</Link>
              <Link href="/wiki">{texts['nav.wiki']}</Link>
            </nav>
            <nav className={styles.column} aria-label={texts['nav.footer.project']}>
              <span className={styles.columnTitle}>{texts['nav.footer.project']}</span>
              <Link href="/about">{texts['nav.footer.about']}</Link>
              <Link href="/zero">{texts['nav.zero']}</Link>
              <Link href="/join">{texts['nav.join']}</Link>
              <Link href="/points">{texts['nav.points']}</Link>
              {env.FEATURE_CORNER && <Link href="/corner">{texts['nav.corner']}</Link>}
            </nav>
          </div>

          <div className={styles.links}>
            <a
              className={`${styles.social} ${styles.socialTelegram}`}
              href={publicEnv.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PixelIcon name="telegram" size={14} />
              Telegram
            </a>
            <a
              className={`${styles.social} ${styles.socialDiscord}`}
              href={publicEnv.discordUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PixelIcon name="chat" size={14} />
              Discord
            </a>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.credits}>
            <span>© {year} KRUG</span>
            <span className={styles.creditsDot} aria-hidden="true" />
            <span>Дизайн by Fupasmak</span>
          </span>
          <SiteTextView value={texts['footer.disclaimer']} />
        </div>
      </div>
    </footer>
  );
}
