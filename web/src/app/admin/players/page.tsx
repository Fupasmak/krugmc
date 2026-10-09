import { AdminPlayers, type AdminPlayer } from './AdminPlayers';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminPlayersPage() {
  const user = await currentUser();

  const rows = await prisma.user.findMany({
    where: { type: 'MC' },
    orderBy: [{ mcNicknameLower: 'asc' }],
    select: {
      id: true,
      mcNickname: true,
      mcNicknameLower: true,
      mcUuid: true,
      cardFile: true,
      hidden: true,
      role: true,
      firstLoginAt: true,
      _count: { select: { posts: { where: { deletedAt: null } } } },
    },
  });

  const players: AdminPlayer[] = rows.map((row) => ({
    id: row.id,
    nickname: row.mcNickname ?? '-',
    slug: row.mcNicknameLower ?? '',
    uuid: row.mcUuid,
    cardFile: row.cardFile,
    hidden: row.hidden,
    role: row.role,
    firstLoginAt: row.firstLoginAt?.toISOString() ?? null,
    posts: row._count.posts,
  }));

  return (
    <>
      <div className="section-title">
        <h2>Игроки</h2>
      </div>
      <AdminPlayers players={players} superadmin={user?.role === 'SUPERADMIN'} />
    </>
  );
}
