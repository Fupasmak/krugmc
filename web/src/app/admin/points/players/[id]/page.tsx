import { currentUser } from '@/lib/auth';
import { playerPoints } from '@/server/points';
import { PlayerPoints } from './PlayerPoints';

export default async function PlayerPointsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentUser();
  const data = await playerPoints(actor, id);
  return <PlayerPoints data={data} />;
}
