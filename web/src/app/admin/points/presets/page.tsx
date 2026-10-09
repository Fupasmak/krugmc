import { currentUser } from '@/lib/auth';
import { listPresets } from '@/server/points';
import { PresetsEditor } from './PresetsEditor';

export default async function PresetsPage() {
  const actor = await currentUser();
  const presets = await listPresets(actor);
  return (
    <PresetsEditor
      canEdit={actor?.role === 'SUPERADMIN'}
      presets={presets.map((preset) => ({
        id: preset.id,
        category: preset.category,
        title: preset.title,
        description: preset.description,
        amount: preset.amount,
        oncePerSeason: preset.oncePerSeason,
        active: preset.active,
        order: preset.order,
      }))}
    />
  );
}
