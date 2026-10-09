import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './posts.module.css';
import { PostCard } from '@/components/PostCard';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { currentUser, isAdmin } from '@/lib/auth';
import { listPostsPage } from '@/server/posts';
import { voteAccess } from '@/lib/vote-access';
import { formatCount } from '@/lib/format';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['posts.title'], description: texts['posts.description'] };
}

export const dynamic = 'force-dynamic';

const TAGS = [
  { value: '', key: 'posts.filter.all' },
  { value: 'STREAM', key: 'tag.stream' },
  { value: 'OFFSTREAM', key: 'tag.offstream' },
] as const;

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const [viewer, texts] = await Promise.all([currentUser(), getTexts()]);
  const staff = isAdmin(viewer);

  const tag = params.tag === 'STREAM' || params.tag === 'OFFSTREAM' ? params.tag : null;
  const page = Number.parseInt(params.page ?? '1', 10) || 1;

  const feed = await listPostsPage({ page, tag, viewerId: viewer?.id ?? null });

  const link = (target: number) => {
    const search = new URLSearchParams();
    if (tag) search.set('tag', tag);
    if (target > 1) search.set('page', String(target));
    const query = search.toString();
    return query ? `/posts?${query}` : '/posts';
  };

  return (
    <div className="container page">
      <SectionHeading as="h1" title={texts['posts.title']} block="emerald.png">
        {viewer?.type === 'MC' && (
          <Link href="/posts/new" className="btn btn--gold btn--sm">
            {texts['posts.new']}
          </Link>
        )}
      </SectionHeading>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {TAGS.map((item) => {
            const active = (tag ?? '') === item.value;
            const href = item.value ? `/posts?tag=${item.value}` : '/posts';
            return (
              <Link
                key={item.key}
                href={href}
                className={`${styles.filter} ${active ? styles.filterActive : ''}`}
              >
                {texts[item.key]}
              </Link>
            );
          })}
        </div>
        <span className={styles.count}>
          {formatCount(feed.total, 'завоз', 'завоза', 'завозов')}
        </span>
      </div>

      {feed.posts.length > 0 ? (
        <div className={styles.feed}>
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
          title={tag ? texts['posts.emptyTag.title'] : texts['empty.posts.title']}
          note={
            tag ? (
              <SiteTextView value={texts['posts.emptyTag.note']} />
            ) : (
              <SiteTextView value={texts['empty.posts.note']} />
            )
          }
          block="slime.png"
          action={tag ? { href: '/posts', label: texts['posts.emptyTag.action'] } : undefined}
        />
      )}

      {feed.pages > 1 && (
        <nav className={styles.pager} aria-label="Страницы">
          {feed.page > 1 ? (
            <Link href={link(feed.page - 1)} className="btn btn--stone btn--sm">
              {texts['posts.prev']}
            </Link>
          ) : (
            <span className="btn btn--stone btn--sm" aria-disabled="true">
              {texts['posts.prev']}
            </span>
          )}
          <span className={styles.pagerInfo}>
            {feed.page} / {feed.pages}
          </span>
          {feed.page < feed.pages ? (
            <Link href={link(feed.page + 1)} className="btn btn--stone btn--sm">
              {texts['posts.next']}
            </Link>
          ) : (
            <span className="btn btn--stone btn--sm" aria-disabled="true">
              {texts['posts.next']}
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
