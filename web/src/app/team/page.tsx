import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SkinHead } from '@/components/SkinHead';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { cardUrl } from '@/server/players';
import styles from '../players/players.module.css';
import { getTexts } from '@/server/texts';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['team.title'], description: texts['team.description'] };
}

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  // Раздел отложен: включается флагом FEATURE_TEAM, состав заполняется в базе.
  if (!env.FEATURE_TEAM) notFound();

  const texts = await getTexts();
  const members = await prisma.teamMember.findMany({
    where: { visible: true },
    orderBy: [{ order: 'asc' }, { nickname: 'asc' }],
  });

  return (
    <div className="container page">
      <div className="section-title">
        <h1>{texts['team.title']}</h1>
      </div>

      {members.length === 0 ? (
        <div className="panel">{texts['team.empty']}</div>
      ) : (
        <div className={styles.grid}>
          {members.map((member) => (
            <article key={member.id} className="panel">
              <img
                src={cardUrl(member.nickname.toLowerCase(), member.cardFile)}
                alt={`Карточка ${member.nickname}`}
                style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                <SkinHead name={member.nickname.toLowerCase()} size={24} />
                <strong>{member.nickname}</strong>
              </div>
              <span className="faint">{member.role}</span>
              <p className="muted">{member.about}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
