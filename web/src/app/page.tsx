import Link from 'next/link';
import styles from './home.module.css';
import { BlockOrbit } from '@/components/BlockOrbit';
import { BlockButton } from '@/components/BlockButton';
import { Button } from '@/components/Button';
import { HeroTitle } from '@/components/HeroTitle';
import { StatusPanel } from '@/components/StatusPanel';
import { GroundStrip } from '@/components/GroundStrip';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { TrailerCard } from '@/components/TrailerCard';
import { PlayerCard } from '@/components/PlayerCard';
import { PostCard } from '@/components/PostCard';
import { SkinHead } from '@/components/SkinHead';
import { currentUser, isAdmin } from '@/lib/auth';
import { getSettings, PROJECT_STATUSES } from '@/lib/settings';
import { publicEnv } from '@/lib/env';
import { listPosts, topAuthors } from '@/server/posts';
import { randomPlayers } from '@/server/players';
import { prisma } from '@/lib/prisma';
import { voteAccess } from '@/lib/vote-access';
import { formatDate, formatCount } from '@/lib/format';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [viewer, settings, texts] = await Promise.all([currentUser(), getSettings(), getTexts()]);

  const [{ posts }, authors, week] = await Promise.all([
    listPosts({ limit: 3, viewerId: viewer?.id ?? null }),
    topAuthors(7, 3),
    prisma.archiveWeek.findFirst({
      where: { published: true },
      orderBy: { number: 'desc' },
      include: {
        items: { orderBy: { order: 'asc' }, take: 3 },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const fallbackPlayers = authors.length === 0 ? await randomPlayers(3) : [];
  const staff = isAdmin(viewer);

  return (
    <>
      <div className="container">
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <HeroTitle text={texts['hero.title']} />

            <SiteTextView as="p" className={styles.heroLead} value={texts['hero.lead']} />

            <div className={styles.heroButtons}>
              {viewer ? (
                <Button href="/posts">{texts['hero.button.posts']}</Button>
              ) : (
                <>
                  <BlockButton href="/login" variant="grass">
                    {texts['hero.button.login']}
                  </BlockButton>
                  <Button href="/join">{texts['hero.button.join']}</Button>
                </>
              )}
              <Button href="/zero">{texts['hero.button.zero']}</Button>
            </div>

            <StatusPanel
              label={texts['hero.status.label']}
              status={PROJECT_STATUSES[settings.projectStatus]}
              note={settings.projectStatusNote}
            />
          </div>

          <div className={styles.heroArt}>
            <BlockOrbit phrase={texts['home.bubble']} />
          </div>
        </section>
      </div>

      <GroundStrip />

      <div className="container">
        <section className={styles.section}>
          <div className={styles.twoColumns}>
            <div>
              <SectionHeading
                title={texts['section.trailer'] || settings.trailerTitle || 'Трейлер'}
                block="diamond_ore.png"
              />
              <TrailerCard
                followLabel={texts['home.trailer.follow']}
                url={settings.trailerUrl}
                title={settings.trailerTitle || 'Трейлер KRUG'}
                emptyTitle={texts['empty.trailer.title']}
                telegramUrl={publicEnv.telegramUrl}
                hint={
                  staff ? (
                    'Ссылка ставится в админке: Настройки, поле «Трейлер».'
                  ) : (
                    <SiteTextView value={texts['empty.trailer.note']} />
                  )
                }
              />
            </div>

            <div>
              <SectionHeading title={texts['section.week']} block="bricks.png" href="/archive" />
              {week ? (
                <div className={styles.weekCard}>
                  <span className={styles.weekNumber}>№{week.number}</span>
                  <span className={styles.weekTitle}>{week.title}</span>
                  <span className="faint">
                    {formatDate(week.startsAt)} {texts['home.week.to']} {formatDate(week.endsAt)},{' '}
                    {formatCount(week._count.items, 'запись', 'записи', 'записей')}
                  </span>
                  {week.items.length > 0 && (
                    <div className={styles.weekItems}>
                      {week.items.map((item) =>
                        item.path ? (
                          <img
                            key={item.id}
                            className={styles.weekThumb}
                            src={`/uploads/${item.path}`}
                            alt={item.title}
                            loading="lazy"
                          />
                        ) : (
                          <span key={item.id} className={styles.weekThumb} />
                        ),
                      )}
                    </div>
                  )}
                  {week.summary && <p className="muted">{week.summary}</p>}
                  <Link href={`/archive/week/${week.number}`} className="btn btn--stone btn--sm">
                    {texts['home.week.open']}
                  </Link>
                </div>
              ) : (
                <EmptyState
                  title={texts['empty.week.title']}
                  note={<SiteTextView value={texts['empty.week.note']} />}
                  block="oak_log.png"
                  compact
                />
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <SectionHeading
            title={authors.length > 0 ? texts['section.top'] : texts['empty.players.title']}
            block="moss.webp"
            href="/players"
          />
          {authors.length > 0 ? (
            <div className={styles.top}>
              {authors.map((row, index) => (
                <Link
                  key={row.user.id}
                  href={`/players/${row.user.mcNicknameLower ?? ''}`}
                  className={`${styles.topItem} card-hover`}
                >
                  <span className={styles.topPlace}>{index + 1}</span>
                  <SkinHead name={row.user.mcNicknameLower ?? row.user.mcNickname} size={30} />
                  <span className={styles.topBody}>
                    <span className={styles.topLine}>
                      <span className={styles.topName}>{row.user.mcNickname}</span>
                      <span
                        className={`${styles.topScore} ${
                          row.score > 0
                            ? styles.topScorePositive
                            : row.score < 0
                              ? styles.topScoreNegative
                              : ''
                        }`}
                      >
                        {row.score > 0 ? `+${row.score}` : row.score}
                      </span>
                    </span>
                    <span className={styles.topPosts}>
                      {formatCount(row.posts, 'завоз', 'завоза', 'завозов')}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : fallbackPlayers.length > 0 ? (
            <div className={styles.players}>
              {fallbackPlayers.map((player) => (
                <PlayerCard
                  neverLabel={texts['players.never']}
                  key={player.id}
                  nickname={player.mcNickname}
                  slug={player.mcNicknameLower}
                  cardFile={player.cardFile}
                  posts={player._count.posts}
                  firstLoginAt={player.firstLoginAt}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={texts['empty.players.title']}
              note={<SiteTextView value={texts['empty.players.note']} />}
              block="moss.png"
              action={{ href: '/login', label: texts['hero.button.login'] }}
            />
          )}
        </section>

        <section className={styles.section}>
          <SectionHeading title={texts['section.posts']} block="emerald.png" href="/posts" />
          {posts.length > 0 ? (
            <div className={styles.feed}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  access={voteAccess(viewer, post.authorId)}
                  canManage={Boolean(viewer && (viewer.id === post.authorId || staff))}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={texts['home.posts.empty.title']}
              note={<SiteTextView value={texts['home.posts.empty.note']} />}
              block="slime.png"
            />
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.aboutBlock}>
            <article className={`${styles.aboutCard} card-hover`}>
              <img className={styles.aboutIcon} src="/blocks/moss.webp" alt="" width={34} height={34} />
              <h2>{texts['about.card.title']}</h2>
              <SiteTextView as="p" className="muted" value={texts['about.card.text']} />
              <Link href="/about" className="btn btn--stone btn--sm">
                {texts['home.about.more']}
              </Link>
            </article>

            <article className={`${styles.aboutCard} card-hover`}>
              <img
                className={styles.aboutIcon}
                src="/blocks/emerald.png"
                alt=""
                width={34}
                height={34}
              />
              <h2>{texts['zero.card.title']}</h2>
              <SiteTextView as="p" className="muted" value={texts['zero.card.text']} />
              <Link href="/zero" className="btn btn--emerald btn--sm">
                {texts['home.zero.more']}
              </Link>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
