import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../archive/archive.module.css';
import { SkinHead } from '@/components/SkinHead';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { parseVideoUrl } from '@/lib/youtube';
import { formatDate, formatCount } from '@/lib/format';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['media.title'], description: texts['media.description'] };
}

export const dynamic = 'force-dynamic';

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string }>;
}) {
  const params = await searchParams;
  const author = params.author?.trim().toLowerCase();

  const [items, authors, texts] = await Promise.all([
    prisma.mediaItem.findMany({
      where: author ? { author: { mcNicknameLower: author } } : {},
      orderBy: { publishedAt: 'desc' },
      include: {
        author: { select: { mcNickname: true, mcNicknameLower: true } },
        week: { select: { number: true } },
      },
      take: 120,
    }),
    prisma.user.findMany({
      where: { type: 'MC', mediaItems: { some: {} } },
      select: { mcNickname: true, mcNicknameLower: true },
      orderBy: { mcNicknameLower: 'asc' },
    }),
    getTexts(),
  ]);

  return (
    <div className="container page">
      <SectionHeading
        as="h1"
        title={texts['media.title']}
        block="diamond_ore.png"
        note={formatCount(items.length, 'видео', 'видео', 'видео')}
      />

      {authors.length > 0 && (
        <div className={styles.filters}>
          <Link
            href="/media"
            className={`${styles.filter} ${!author ? styles.filterActive : ''}`}
          >
            {texts['media.all']}
          </Link>
          {authors.map((item) => (
            <Link
              key={item.mcNicknameLower}
              href={`/media?author=${item.mcNicknameLower}`}
              className={`${styles.filter} ${author === item.mcNicknameLower ? styles.filterActive : ''}`}
            >
              {item.mcNickname}
            </Link>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <div className={styles.gallery}>
          {items.map((item) => {
            const video = parseVideoUrl(item.url);
            const thumb = item.thumbnail ?? video.thumbnail;

            return (
              <a
                key={item.id}
                className={styles.item}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {thumb && <img src={thumb} alt={item.title} loading="lazy" />}
                <div className={styles.itemBody}>
                  <span className={styles.itemKind}>
                    {video.provider === 'vk' ? 'VK Видео' : 'YouTube'}
                    {item.week ? ` · ${texts['archive.week']} ${item.week.number}` : ''}
                  </span>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.description && <span className="faint">{item.description}</span>}
                  <span className="faint">{formatDate(item.publishedAt)}</span>
                  {item.author?.mcNickname && (
                    <span className={styles.itemAuthor}>
                      <SkinHead name={item.author.mcNicknameLower} size={18} />
                      {item.author.mcNickname}
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={texts['media.empty.title']}
          note={<SiteTextView value={texts['media.empty.note']} />}
          block="sculk_shrieker.gif"
        />
      )}
    </div>
  );
}
