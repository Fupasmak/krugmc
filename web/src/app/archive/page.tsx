import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './archive.module.css';
import { SkinHead } from '@/components/SkinHead';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { currentUser, isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDate, formatCount } from '@/lib/format';
import { parseVideoUrl } from '@/lib/youtube';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['archive.title'], description: texts['archive.description'] };
}

export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: '', label: 'archive.filter.all' },
  { value: 'BUILD', label: 'archive.filter.build' },
  { value: 'ART', label: 'archive.filter.art' },
  { value: 'VIDEO', label: 'archive.filter.video' },
  { value: 'LIFE', label: 'archive.filter.life' },
] as const;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  const [viewer, texts] = await Promise.all([currentUser(), getTexts()]);
  const staff = isAdmin(viewer);

  const kind = FILTERS.some((item) => item.value && item.value === params.kind)
    ? (params.kind as 'BUILD' | 'ART' | 'VIDEO' | 'LIFE')
    : null;

  const weekFilter = staff ? {} : { published: true };

  const [weeks, items] = await Promise.all([
    prisma.archiveWeek.findMany({
      where: weekFilter,
      orderBy: { number: 'desc' },
      include: { _count: { select: { items: true } } },
    }),
    prisma.archiveItem.findMany({
      where: { ...(kind ? { kind } : {}), week: weekFilter },
      orderBy: [{ week: { number: 'desc' } }, { order: 'asc' }],
      take: 60,
      include: {
        author: { select: { mcNickname: true, mcNicknameLower: true } },
        week: { select: { number: true } },
      },
    }),
  ]);

  const latest = weeks[0];

  return (
    <div className="container page">
      <SectionHeading
        as="h1"
        title={texts['archive.title']}
        block="bricks.png"
        note={formatCount(weeks.length, 'неделя', 'недели', 'недель')}
      />

      {latest ? (
        <div className={styles.highlight}>
          <div>
            <span className={styles.number}>№{latest.number}</span>
            <h2 style={{ margin: '8px 0' }}>{latest.title}</h2>
            <span className="faint">
              {formatDate(latest.startsAt)}: {formatDate(latest.endsAt)}
            </span>
          </div>
          <div>
            {latest.summary && <p className="muted">{latest.summary}</p>}
            <p className="faint">
              {formatCount(latest._count.items, 'запись', 'записи', 'записей')} {texts['archive.perWeek']}
            </p>
            <Link href={`/archive/week/${latest.number}`} className="btn btn--grass btn--sm">
              {texts['archive.open']}
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState
          title={texts['empty.week.title']}
          note={<SiteTextView value={texts['empty.week.note']} />}
          block="oak_log.png"
        />
      )}

      {weeks.length > 1 && (
        <>
          <SectionHeading title={texts['archive.weeks']} block="end_stone.png" />
          <div className={styles.weeks}>
            {weeks.map((week) => (
              <Link key={week.id} href={`/archive/week/${week.number}`} className={styles.week}>
                <span className={styles.weekNumber}>№{week.number}</span>
                <strong>{week.title}</strong>
                <span className="faint">
                  {formatCount(week._count.items, 'запись', 'записи', 'записей')}
                </span>
                {!week.published && <span className={styles.draft}>{texts['archive.draft']}</span>}
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionHeading title={texts['archive.all']} block="diamond_ore.png" />

      <div className={styles.filters}>
        {FILTERS.map((filter) => {
          const active = (kind ?? '') === filter.value;
          const href = filter.value ? `/archive?kind=${filter.value}` : '/archive';
          return (
            <Link
              key={filter.label}
              href={href}
              className={`${styles.filter} ${active ? styles.filterActive : ''}`}
            >
              {texts[filter.label]}
            </Link>
          );
        })}
      </div>

      {items.length > 0 ? (
        <div className={styles.gallery}>
          {items.map((item) => {
            const video = item.url ? parseVideoUrl(item.url) : null;
            const image = item.path
              ? `/uploads/${item.path}`
              : (video?.thumbnail ?? null);

            const content = (
              <>
                {image && <img src={image} alt={item.title} loading="lazy" />}
                <div className={styles.itemBody}>
                  <span className={styles.itemKind}>
                    {texts[`archive.kind.${item.kind.toLowerCase()}`]} · {texts['archive.week']} {item.week.number}
                  </span>
                  <span className={styles.itemTitle}>{item.title}</span>
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
                {content}
              </a>
            ) : (
              <Link key={item.id} className={styles.item} href={`/archive/week/${item.week.number}`}>
                {content}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={texts['archive.emptyTag.title']}
          note={texts['archive.emptyTag.note']}
          block="command_block.png"
          action={{ href: '/archive', label: texts['archive.emptyTag.action'] }}
        />
      )}
    </div>
  );
}
