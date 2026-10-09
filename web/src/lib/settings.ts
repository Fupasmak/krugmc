import 'server-only';
import { prisma } from './prisma';
import { DEFAULT_SETTINGS, type SiteSettings } from './site-settings';

export { PROJECT_STATUSES, DEFAULT_SETTINGS } from './site-settings';
export type { SiteSettings, ProjectStatusKey } from './site-settings';

const SETTINGS_KEY = 'site';

export async function getSettings(): Promise<SiteSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<SiteSettings>) };
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings();
  const next: SiteSettings = { ...current, ...patch };
  await prisma.siteSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: next },
    update: { value: next },
  });
  return next;
}
