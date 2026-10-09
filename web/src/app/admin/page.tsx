import styles from './admin.module.css';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format';
import { getSettings, PROJECT_STATUSES } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const [players, waiting, posts, deleted, votes, weeks, media, log, settings] = await Promise.all([
    prisma.user.count({ where: { type: 'MC' } }),
    prisma.user.count({ where: { type: 'MC', firstLoginAt: null } }),
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.post.count({ where: { NOT: { deletedAt: null } } }),
    prisma.vote.count(),
    prisma.archiveWeek.count(),
    prisma.mediaItem.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { actor: { select: { mcNickname: true, tgUsername: true } } },
    }),
    getSettings(),
  ]);

  const stats = [
    { label: 'Игроков', value: players },
    { label: 'Не заходили', value: waiting },
    { label: 'Завозов', value: posts },
    { label: 'Удалено', value: deleted },
    { label: 'Голосов', value: votes },
    { label: 'Недель архива', value: weeks },
    { label: 'Видео', value: media },
  ];

  return (
    <>
      <div className={styles.cards}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 'var(--gap-lg)' }}>
        <strong>Статус проекта: {PROJECT_STATUSES[settings.projectStatus]}</strong>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          {settings.projectStatusNote || 'Заметки нет.'} Набор{' '}
          {settings.joinOpen ? 'открыт' : 'закрыт'}.
        </p>
      </div>

      <div className="section-title">
        <h2>Последние действия</h2>
      </div>
      <div className={`panel ${styles.log}`}>
        {log.length === 0 && <span className="faint">Пока ничего не происходило.</span>}
        {log.map((entry) => (
          <span key={entry.id}>
            <span className="faint">{formatDateTime(entry.createdAt)}</span>{' '}
            {entry.actor?.mcNickname ?? entry.actor?.tgUsername ?? 'система'}, {entry.action}
            {entry.target ? ` · ${entry.target}` : ''}
          </span>
        ))}
      </div>
    </>
  );
}
