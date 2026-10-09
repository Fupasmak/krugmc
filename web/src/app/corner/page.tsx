import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentPage } from '@/components/ContentPage';
import { readContent } from '@/lib/content';
import { env } from '@/lib/env';
import { getTexts } from '@/server/texts';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['corner.title'], description: texts['corner.description'] };
}

export const dynamic = 'force-dynamic';

export default async function CornerPage() {
  // Страница включается флагом FEATURE_CORNER, пока сабсервера нет.
  if (!env.FEATURE_CORNER) notFound();

  const [markdown, texts] = await Promise.all([readContent('corner'), getTexts()]);
  return <ContentPage title={texts['corner.title']} markdown={markdown} />;
}
