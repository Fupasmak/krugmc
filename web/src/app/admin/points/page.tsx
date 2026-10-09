import { currentUser } from '@/lib/auth';
import { pointsOverview } from '@/server/points';
import { PointsTable } from './PointsTable';

export default async function PointsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const actor = await currentUser();
  const data = await pointsOverview(actor, { weekId: week ?? null });
  return <PointsTable data={data} />;
}
