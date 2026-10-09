import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import styles from '../players/players.module.css';
import { SkinHead } from '@/components/SkinHead';
import { PostCard } from '@/components/PostCard';
import { ChannelForm } from '@/components/ChannelForm';
import { LogoutButtons } from '@/components/LogoutButtons';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { currentUser, isAdmin } from '@/lib/auth';
import { cardUrl } from '@/server/players';
import { listPostsPage } from '@/server/posts';
import { voteAccess } from '@/lib/vote-access';
import { formatDate, formatCount } from '@/lib/format';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTexts())['me.title'], robots: { index: false } };
}

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const [user, texts] = await Promise.all([currentUser(), getTexts()]);
  if (!user) redirect('/login');
  if (user.type !== 'MC') redirect('/posts');

  const feed = await listPostsPage({
    page: 1,
    authorId: user.id,
    viewerId: user.id,
    pageSize: 20,
  });

  const staff = isAdmin(user);

  return (
    <div className="container page">
      <div className="section-title">
        <h1>{texts['me.title']}</h1>
        {staff && (
          <Link href="/admin" className="btn btn--gold btn--sm">
            {texts['me.admin']}
          </Link>
        )}
      </div>

      <div className={styles.profile}>
        <div>
          <div className={styles.card}>
            <img
              src={cardUrl(user.mcNicknameLower, user.cardFile)}
              alt={`Карточка игрока ${user.mcNickname}`}
            />
          </div>
          <p className="faint" style={{ marginTop: 'var(--gap-sm)' }}>
            <SiteTextView value={texts['me.cardNote']} />
          </p>
        </div>

        <div>
          <div className={styles.head}>
            <SkinHead name={user.mcNicknameLower ?? user.mcNickname} size={72} />
            <div>
              <span className={styles.nickname}>{user.mcNickname}</span>
              <div className="faint">
                {user.role === 'SUPERADMIN'
                  ? texts['me.role.superadmin']
                  : user.role === 'ADMIN'
                    ? texts['me.role.admin']
                    : texts['me.role.player']}
              </div>
            </div>
          </div>

          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factLabel}>{texts['me.first']}</span>
              <span className={styles.factValue}>
                {user.firstLoginAt ? formatDate(user.firstLoginAt) : '-'}
              </span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>{texts['me.last']}</span>
              <span className={styles.factValue}>
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}
              </span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>UUID</span>
              <span className={styles.factValue}>{user.mcUuid ?? '-'}</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factLabel}>{texts['me.postsCount']}</span>
              <span className={styles.factValue}>{feed.total}</span>
            </div>
          </div>

          <section className="panel" style={{ marginBottom: 'var(--gap-lg)' }}>
            <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--gap-sm)' }}>
              {texts['me.channel']}
            </h2>
            <ChannelForm channel={user.tgChannel} />
          </section>

          <section className="panel" style={{ marginBottom: 'var(--gap-lg)' }}>
            <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--gap-sm)' }}>{texts['me.sessions']}</h2>
            <LogoutButtons />
          </section>

          <section>
            <SectionHeading
              title={texts['me.posts']}
              block="emerald.png"
              note={formatCount(feed.total, 'завоз', 'завоза', 'завозов')}
            >
              <Link href="/posts/new" className="btn btn--gold btn--sm">
                {texts['me.newPost']}
              </Link>
            </SectionHeading>

            {feed.posts.length > 0 ? (
              <div className={styles.posts}>
                {feed.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    access={voteAccess(user, post.authorId)}
                    canManage
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={texts['me.empty.title']}
                note={<SiteTextView value={texts['me.empty.text']} />}
                block="slime.png"
                action={{ href: '/posts/new', label: texts['me.empty.action'] }}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
