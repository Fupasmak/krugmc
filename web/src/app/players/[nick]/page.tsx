import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '../players.module.css';
import { SkinHead } from '@/components/SkinHead';
import { PostCard } from '@/components/PostCard';
import { SectionHeading } from '@/components/SectionHeading';
import { ChannelPosts } from '@/components/ChannelPosts';
import { PixelIcon } from '@/components/PixelIcon';
import { EmptyState } from '@/components/EmptyState';
import { currentUser, isAdmin } from '@/lib/auth';
import { cardUrl, getPlayer } from '@/server/players';
import { listPostsPage } from '@/server/posts';
import { voteAccess } from '@/lib/vote-access';
import { renderContentMarkdown } from '@/lib/markdown';
import { formatDate, formatCount } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getTexts } from '@/server/texts';
import { fillText } from '@/lib/site-texts';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nick: string }>;
}): Promise<Metadata> {
  const { nick } = await params;
  const player = await getPlayer(nick);
  const texts = await getTexts();
  if (!player) return { title: texts['player.notFound'] };

  return {
    title: player.mcNickname ?? texts['player.role'],
    description: fillText(texts['player.description'], { nick: player.mcNickname ?? '' }),
    openGraph: {
      title: `${player.mcNickname} · KRUG`,
      images: [{ url: cardUrl(player.mcNicknameLower, player.cardFile) }],
    },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ nick: string }> }) {
  const { nick } = await params;
  const [viewer, texts] = await Promise.all([currentUser(), getTexts()]);
  const staff = isAdmin(viewer);

  const player = await getPlayer(nick);
  if (!player || (player.hidden && !staff)) notFound();

  const [feed, media] = await Promise.all([
    listPostsPage({ page: 1, authorId: player.id, viewerId: viewer?.id ?? null, pageSize: 20 }),
    prisma.mediaItem.findMany({
      where: { authorId: player.id },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: { id: true, title: true, url: true },
    }),
  ]);

  const wiki = player.wikiText ? renderContentMarkdown(player.wikiText) : null;

  return (
    <div className="container page">
      <div className={styles.profile}>
        <div>
          <div className={styles.card}>
            <img
              src={cardUrl(player.mcNicknameLower, player.cardFile)}
              alt={`Карточка игрока ${player.mcNickname}`}
            />
          </div>
          {staff && (
            <Link
              href="/admin/players"
              className="btn btn--stone btn--sm"
              style={{ marginTop: 'var(--gap-sm)' }}
            >
              {texts['player.adminEdit']}
            </Link>
          )}
        </div>

        <div>
          <div className={styles.head}>
            <SkinHead name={player.mcNicknameLower ?? player.mcNickname} size={72} />
            <div>
              <h1 className={styles.nickname}>{player.mcNickname}</h1>
              <span className="faint">{texts['player.role']}</span>
            </div>
          </div>

          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factLabel}>{texts['player.first']}</span>
              <span className={styles.factValue}>
                {player.firstLoginAt ? formatDate(player.firstLoginAt) : texts['player.never']}
              </span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>{texts['player.postsCount']}</span>
              <span className={styles.factValue}>{player._count.posts}</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>UUID</span>
              <span className={styles.factValue}>{player.mcUuid ?? '-'}</span>
            </div>
          </div>

          {player.tgChannel && (
            <section style={{ marginBottom: 'var(--gap-lg)' }}>
              <SectionHeading title={texts['player.channel']} block="diamond.png">
                <a
                  className="btn btn--telegram btn--sm"
                  href={`https://t.me/${player.tgChannel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PixelIcon name="telegram" size={12} />@{player.tgChannel}
                </a>
              </SectionHeading>
              <ChannelPosts channel={player.tgChannel} />
            </section>
          )}

          {wiki && (
            <section style={{ marginBottom: 'var(--gap-lg)' }}>
              <SectionHeading title={texts['player.about']} block="birch_log.png" />
              <div className="prose" dangerouslySetInnerHTML={{ __html: wiki }} />
            </section>
          )}

          {media.length > 0 && (
            <section style={{ marginBottom: 'var(--gap-lg)' }}>
              <SectionHeading title={texts['player.videos']} block="diamond_ore.png" />
              <ul>
                {media.map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionHeading
              title={texts['player.posts']}
              block="emerald.png"
              note={formatCount(feed.total, 'завоз', 'завоза', 'завозов')}
            />
            {feed.posts.length > 0 ? (
              <div className={styles.posts}>
                {feed.posts.map((post) => (
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
                title={texts['player.empty.title']}
                note={texts['player.empty.note']}
                block="slime.png"
                compact
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
