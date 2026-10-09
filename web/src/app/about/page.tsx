import type { Metadata } from 'next';
import { ContentPage } from '@/components/ContentPage';
import Link from 'next/link';
import { readContent } from '@/lib/content';
import { getTexts } from '@/server/texts';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['about.title'], description: texts['about.description'] };
}

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const [markdown, texts] = await Promise.all([readContent('about'), getTexts()]);
  return (
    <ContentPage
      title={texts['about.title']}
      markdown={markdown}
      after={
        <p style={{ marginTop: 'var(--gap-xl)' }}>
          <Link href="/points" className="btn btn--sm">
            {texts['points.aboutLink']} →
          </Link>
        </p>
      }
    />
  );
}
