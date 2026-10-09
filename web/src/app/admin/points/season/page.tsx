import { currentUser } from '@/lib/auth';
import { seasonState } from '@/server/points';
import { SeasonControls } from './SeasonControls';

export default async function SeasonPage() {
  const actor = await currentUser();
  const data = await seasonState(actor);
  return <SeasonControls data={data} superadmin={actor?.role === 'SUPERADMIN'} />;
}
