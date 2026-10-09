import type { Metadata } from 'next';
import { ContentPage } from '@/components/ContentPage';
import { FloatingBlocks } from '@/components/FloatingBlocks';
import { readContent } from '@/lib/content';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['zero.title'], description: texts['zero.description'] };
}

export const dynamic = 'force-dynamic';

export default async function ZeroPage() {
  const [markdown, texts] = await Promise.all([readContent('zero'), getTexts()]);

  return (
    <ContentPage
      title={texts['zero.title']}
      markdown={markdown}
      decoration={<FloatingBlocks />}
      intro={
        <div className="muted" style={{ maxWidth: '62ch', position: 'relative', zIndex: 1 }}>
          <SiteTextView as="p" value={texts['zero.intro']} />
        </div>
      }
    />
  );
}
