import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '../../archive.module.css';
import { SkinHead } from '@/components/SkinHead';
import { currentUser, isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/format';
import { parseVideoUrl } from '@/lib/youtube';
import { getTexts } from '@/server/texts';
import { fillText } from '@/lib/site-texts';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  const week = await prisma.archiveWeek.findUnique({
    where: { number: Number(number) || 0 },
    select: { title: true, summary: true, published: true },
  });
  const texts = await getTexts();
  if (!week) return { title: texts['archiveWeek.notFound'] };

  return {
    title: fillText(texts['archiveWeek.metaTitle'], { number, title: week.title }),
    description: week.summary ?? fillText(texts['archiveWeek.metaDescription'], { number }),
    robots: week.published ? undefined : { index: false },
  };
}

export default async function ArchiveWeekPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const parsed = Number.parseInt(number, 10);
  if (Number.isNaN(parsed)) notFound();

  const [viewer, texts] = await Promise.all([currentUser(), getTexts()]);
  const staff = isAdmin(viewer);

  const week = await prisma.archiveWeek.findUnique({
    where: { number: parsed },
    include: {
      items: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: { author: { select: { mcNickname: true, mcNicknameLower: true } } },
      },
      media: { orderBy: { publishedAt: 'desc' } },
    },
  });

  if (!week || (!week.published && !staff)) notFound();

  return (
    <div className="container page">
      <div className="section-title">
        <Link href="/archive" className="btn btn--ghost btn--sm">
          {texts['archiveWeek.back']}
        </Link>
      </div>

      <div className={styles.highlight}>
        <div>
          <span className={styles.number}>№{week.number}</span>
          <h1 style={{ margin: '8px 0', fontSize: 'var(--text-xl)' }}>{week.title}</h1>
          <span className="faint">
            {formatDate(week.startsAt)}: {formatDate(week.endsAt)}
          </span>
          {!week.published && (
            <div>
              <span className={styles.draft}>{texts['archiveWeek.draft']}</span>
            </div>
          )}
        </div>
        <div>{week.summary && <p className="muted">{week.summary}</p>}</div>
      </div>

      {week.items.length > 0 ? (
        <div className={styles.gallery}>
          {week.items.map((item) => {
            const video = item.url ? parseVideoUrl(item.url) : null;
            const image = item.path ? `/uploads/${item.path}` : (video?.thumbnail ?? null);
            const isVideoFile = item.path?.match(/\.(mp4|webm|mov)$/i);

            const inner = (
              <>
                {isVideoFile ? (
                  <video src={`/uploads/${item.path}`} controls preload="metadata" playsInline />
                ) : (
                  image && <img src={image} alt={item.title} loading="lazy" />
                )}
                <div className={styles.itemBody}>
                  <span className={styles.itemKind}>{texts[`archive.kind.${item.kind.toLowerCase()}`]}</span>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.description && <span className="faint">{item.description}</span>}
                  {item.author?.mcNickname && (
                    <span className={styles.itemAuthor}>
                      <SkinHead name={item.author.mcNicknameLower} size={18} />
                      {item.author.mcNickname}
                    </span>
                  )}
                </div>
              </>
            );

            return item.url ? (
              <a
                key={item.id}
                className={styles.item}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <div key={item.id} className={styles.item}>
                {inner}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>{texts['archiveWeek.empty']}</div>
      )}

      {week.media.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 'var(--gap-xl)' }}>
            <h2>{texts['archiveWeek.videos']}</h2>
          </div>
          <ul>
            {week.media.map((item) => (
              <li key={item.id}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
