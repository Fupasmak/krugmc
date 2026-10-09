import { currentUser } from '@/lib/auth';
import { awardOptions } from '@/server/points';
import { AwardForm } from './AwardForm';

export default async function AwardPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string }>;
}) {
  const { player } = await searchParams;
  const actor = await currentUser();
  const options = await awardOptions(actor);
  return <AwardForm options={options} initialPlayer={player ?? null} />;
}
