import type { Metadata } from 'next';
import { ContentPage } from '@/components/ContentPage';
import { readContent } from '@/lib/content';
import { getSettings, PROJECT_STATUSES } from '@/lib/settings';
import { publicEnv } from '@/lib/env';
import { getTexts } from '@/server/texts';
import { fillText } from '@/lib/site-texts';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['join.title'], description: texts['join.description'] };
}

export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  const [markdown, settings, texts] = await Promise.all([
    readContent('join'),
    getSettings(),
    getTexts(),
  ]);

  return (
    <ContentPage
      title={texts['join.title']}
      markdown={markdown}
      intro={
        <div className="panel" style={{ marginBottom: 'var(--gap-lg)', maxWidth: '62ch' }}>
          <strong style={{ color: settings.joinOpen ? 'var(--acid)' : 'var(--text-dim)' }}>
            {settings.joinOpen ? texts['join.open'] : texts['join.closed']}
          </strong>
          <p className="muted" style={{ margin: '6px 0 12px' }}>
            {fillText(texts['join.status'], { status: PROJECT_STATUSES[settings.projectStatus] })}
            {settings.projectStatusNote ? ` ${settings.projectStatusNote}` : ''}
          </p>
          <a
            className={`btn btn--sm ${settings.joinOpen ? 'btn--grass' : 'btn--stone'}`}
            href={publicEnv.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {settings.joinOpen ? texts['join.apply'] : texts['join.follow']}
          </a>
        </div>
      }
    />
  );
}
