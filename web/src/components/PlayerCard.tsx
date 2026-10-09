import Link from 'next/link';
import styles from './PlayerCard.module.css';
import { SkinHead } from './SkinHead';
import { cardUrl } from '@/server/players';
import { formatCount } from '@/lib/format';

export function PlayerCard({
  nickname,
  slug,
  cardFile,
  posts,
  firstLoginAt,
  neverLabel = 'ещё не заходил',
}: {
  nickname: string | null;
  slug: string | null;
  cardFile: string | null;
  posts?: number;
  firstLoginAt?: Date | null;
  neverLabel?: string;
}) {
  const name = nickname ?? 'Игрок';
  const href = `/players/${slug ?? ''}`;

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.picture}>
        <img src={cardUrl(slug, cardFile)} alt={`Карточка игрока ${name}`} loading="lazy" />
        {!firstLoginAt && <span className={styles.badge}>{neverLabel}</span>}
      </div>
      <div className={styles.plate}>
        <SkinHead name={slug ?? name} size={24} />
        <span className={styles.name}>{name}</span>
        {typeof posts === 'number' && (
          <span className={styles.meta}>{formatCount(posts, 'завоз', 'завоза', 'завозов')}</span>
        )}
      </div>
    </Link>
  );
}
