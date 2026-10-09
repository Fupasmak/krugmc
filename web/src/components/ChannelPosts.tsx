import styles from './ChannelPosts.module.css';
import { PixelIcon } from './PixelIcon';
import { ChannelMedia } from './ChannelMedia';
import { getChannelPosts } from '@/server/telegram-channel';
import { formatDateTime } from '@/lib/format';
import { getTexts } from '@/server/texts';
import { fillText } from '@/lib/site-texts';

/**
 * Последние посты канала игрока. Данные забирает сервер и кладёт в кэш,
 * картинки идут через наш прокси. Если Telegram не отдал ленту, показываем
 * заглушку со ссылкой, страница от этого не ломается.
 */
export async function ChannelPosts({ channel }: { channel: string }) {
  const [result, texts] = await Promise.all([getChannelPosts(channel), getTexts()]);

  if (!result.ok) {
    const reason =
      result.error === 'private'
        ? texts['channel.private']
        : result.error === 'not_found'
          ? texts['channel.missing']
          : texts['channel.down'];

    return (
      <div className={styles.empty}>
        <span>{reason}</span>
        <a className="btn btn--telegram btn--sm" href={`https://t.me/${channel}`} target="_blank" rel="noopener noreferrer">
          <PixelIcon name="telegram" size={12} />
          {fillText(texts['channel.open'], { channel })}
        </a>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {result.posts.map((post) => (
        <article className={styles.card} key={post.id}>
          <div className={styles.head}>
            <PixelIcon name="telegram" size={12} />
            <span className={styles.channel}>@{channel}</span>
            {post.date && <span>{formatDateTime(post.date)}</span>}
            {post.views && <span>{post.views}</span>}
          </div>

          {post.media.length > 0 && <ChannelMedia items={post.media} postUrl={post.url} />}

          {post.html && (
            <div className={styles.text} dangerouslySetInnerHTML={{ __html: post.html }} />
          )}

          <div className={styles.foot}>
            <a className="btn btn--ghost btn--sm" href={post.url} target="_blank" rel="noopener noreferrer">
              {texts['channel.read']}
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
