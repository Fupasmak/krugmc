import Link from 'next/link';
import styles from '../points.module.css';
import { currentUser } from '@/lib/auth';
import { formatPoints } from '@/lib/points';
import { weekSummary } from '@/server/points';
import { SkinHead } from '@/components/SkinHead';
import { weekRange } from '../format';

export default async function WeekSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const actor = await currentUser();
  const data = await weekSummary(actor, week ?? null);

  return (
    <>
      <p className={styles.meta}>
        {data.season.title}. Неделя {data.week.number}, {weekRange(data.week.startsAt, data.week.endsAt)}
        {data.week.closed ? ', закрыта' : ', идёт'}.
      </p>

      <nav className={styles.chips} aria-label="Недели" style={{ marginBottom: 'var(--gap)' }}>
        {data.weeks.map((item) => (
          <Link
            key={item.id}
            href={`/admin/points/week?week=${item.id}`}
            className={`${styles.tab} ${item.id === data.week.id ? styles.tabActive : ''}`}
          >
            {item.number}
          </Link>
        ))}
      </nav>

      <h3 className={styles.panelTitle}>Топ недели</h3>
      {data.top.length === 0 ? (
        <p className={styles.meta}>За эту неделю ещё никому ничего не начислили.</p>
      ) : (
        <ol className={styles.top}>
          {data.top.map((row, index) => (
            <li key={row.userId} className={styles.topRow}>
              <span className={styles.place}>{index + 1}</span>
              <SkinHead name={row.nickname} size={28} />
              <Link href={`/admin/points/players/${row.userId}`} className={styles.topName}>
                {row.nickname}
              </Link>
              <span className={styles.topValue}>{formatPoints(row.amount)}</span>
            </li>
          ))}
        </ol>
      )}

      {data.categories.map((group) => (
        <section key={group.category}>
          <h3 className={styles.panelTitle}>{group.label}</h3>
          <ul className={styles.entryList}>
            {group.entries.map((entry) => (
              <li key={entry.id} className={styles.entryItem}>
                <span>
                  <strong>{entry.player}</strong>
                  {entry.presetTitle ? `: ${entry.presetTitle}` : ''}
                </span>
                <span className={`${styles.num} ${entry.amount < 0 ? styles.minus : styles.plus}`}>
                  {formatPoints(entry.amount, true)}
                </span>
                <span className={styles.entryComment}>{entry.comment}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
