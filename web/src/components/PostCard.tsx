import Link from 'next/link';
import styles from './PostCard.module.css';
import { SkinHead } from './SkinHead';
import { VoteButtons, type VoteAccess } from './VoteButtons';
import { PostActions } from './PostActions';
import { MediaGallery } from './MediaGallery';
import { PixelIcon } from './PixelIcon';
import { renderPostMarkdown } from '@/lib/markdown';
import { formatDateTime, formatRelative } from '@/lib/format';
import { publicEnv } from '@/lib/env';
import type { FeedPost } from '@/server/posts';
import { getTexts } from '@/server/texts';

const TAG_KEYS: Record<string, string> = {
  STREAM: 'tag.stream',
  OFFSTREAM: 'tag.offstream',
};

export async function PostCard({
  post,
  access,
  canManage,
  full = false,
}: {
  post: FeedPost;
  access: VoteAccess;
  canManage: boolean;
  full?: boolean;
}) {
  const texts = await getTexts();
  const html = renderPostMarkdown(post.body);
  const nickname = post.author.mcNickname ?? texts['player.role'];
  const slug = post.author.mcNicknameLower ?? '';

  const media = post.attachments.map((file) => ({
    id: file.id,
    kind: file.kind,
    url: `/uploads/${file.path}`,
    mime: file.mime,
    width: file.width,
    height: file.height,
  }));

  return (
    <article className={`${styles.card} ${post.hot ? styles.cardHot : ''}`}>
      <div className={styles.votes}>
        <VoteButtons
          postId={post.id}
          upCount={post.upCount}
          downCount={post.downCount}
          myVote={post.myVote}
          access={access}
          channel={publicEnv.channel}
          telegramUrl={publicEnv.telegramUrl}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.head}>
          <Link href={`/players/${slug}`} className={styles.author}>
            <SkinHead name={slug || nickname} size={24} />
            {nickname}
          </Link>
          {post.hot && (
            <span className={styles.topBadge}>
              <PixelIcon name="fire" size={11} className={styles.topFlame} />
              {texts['post.top']}
            </span>
          )}
          <span className={`tag ${post.tag === 'STREAM' ? 'tag--stream' : ''}`}>
            {texts[TAG_KEYS[post.tag]]}
          </span>
          <time className={styles.date} dateTime={post.createdAt.toISOString()}>
            {full ? formatDateTime(post.createdAt) : formatRelative(post.createdAt)}
          </time>
          {post.pinned && <span className="tag">{texts['post.pinned']}</span>}
        </div>

        <h2 className={styles.title}>
          {full ? (
            post.title
          ) : (
            <Link href={`/posts/${post.id}`} className={styles.titleLink}>
              {post.title}
            </Link>
          )}
        </h2>

        <div
          className={`${styles.text} ${full ? '' : styles.clamp} prose`}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {media.length > 0 && <MediaGallery postId={post.id} items={media} />}

        <div className={styles.foot}>
          {!full && (
            <Link href={`/posts/${post.id}`} className="btn btn--stone btn--sm">
              {texts['post.open']}
            </Link>
          )}
          {post.editedAt && (
            <span className={styles.edited} title={formatDateTime(post.editedAt)}>
              {texts['post.edited']} {formatRelative(post.editedAt)}
            </span>
          )}
          {canManage && (
            <div className={styles.ownerActions}>
              <PostActions postId={post.id} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
