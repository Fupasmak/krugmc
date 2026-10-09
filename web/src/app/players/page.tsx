import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './players.module.css';
import { PlayerCard } from '@/components/PlayerCard';
import { SectionHeading } from '@/components/SectionHeading';
import { EmptyState } from '@/components/EmptyState';
import { listPlayers, type PlayerSort } from '@/server/players';
import { formatCount } from '@/lib/format';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';
import { fillText } from '@/lib/site-texts';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['players.title'], description: texts['players.description'] };
}

export const dynamic = 'force-dynamic';

const SORTS: { value: PlayerSort; label: string }[] = [
  { value: 'nickname', label: 'players.sort.nickname' },
  { value: 'recent', label: 'players.sort.recent' },
  { value: 'posts', label: 'players.sort.posts' },
];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const sort = SORTS.some((item) => item.value === params.sort)
    ? (params.sort as PlayerSort)
    : 'nickname';

  const [players, texts] = await Promise.all([listPlayers({ query, sort }), getTexts()]);

  return (
    <div className="container page">
      <SectionHeading
        as="h1"
        title={texts['players.title']}
        block="moss.webp"
        note={formatCount(players.length, 'игрок', 'игрока', 'игроков')}
      />

      <div className={styles.toolbar}>
        <form className={styles.search} method="get" action="/players">
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={texts['players.search']}
            aria-label={texts['players.search']}
          />
          {sort !== 'nickname' && <input type="hidden" name="sort" value={sort} />}
          <button type="submit" className="btn btn--stone">
            {texts['players.searchButton']}
          </button>
        </form>

        <div className={styles.sorts}>
          {SORTS.map((item) => {
            const search = new URLSearchParams();
            if (query) search.set('q', query);
            if (item.value !== 'nickname') search.set('sort', item.value);
            const href = search.toString() ? `/players?${search}` : '/players';
            return (
              <Link
                key={item.value}
                href={href}
                className={`${styles.sort} ${sort === item.value ? styles.sortActive : ''}`}
              >
                {texts[item.label]}
              </Link>
            );
          })}
        </div>
      </div>

      {players.length > 0 ? (
        <div className={styles.grid}>
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              nickname={player.mcNickname}
              slug={player.mcNicknameLower}
              cardFile={player.cardFile}
              posts={player._count.posts}
              firstLoginAt={player.firstLoginAt}
              neverLabel={texts['players.never']}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={query ? texts['players.notFound.title'] : texts['empty.players.title']}
          note={
            query ? (
              <SiteTextView value={fillText(texts['players.notFound.note'], { query })} />
            ) : (
              <SiteTextView value={texts['empty.players.note']} />
            )
          }
          block="moss.png"
          action={query ? { href: '/players', label: texts['players.showAll'] } : undefined}
        />
      )}
    </div>
  );
}
