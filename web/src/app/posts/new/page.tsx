import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { PostForm } from '@/components/PostForm';
import { SiteTextView } from '@/components/SiteTextView';
import { getTexts } from '@/server/texts';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTexts())['postNew.title'], robots: { index: false } };
}

export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  const [user, texts] = await Promise.all([currentUser(), getTexts()]);
  if (!user) redirect('/login');
  if (user.type !== 'MC') redirect('/posts');

  return (
    <div className="container page">
      <div className="section-title">
        <h1>{texts['postNew.title']}</h1>
      </div>
      <SiteTextView as="p" className="muted" value={texts['postNew.lead']} />

      <PostForm mode="create" maxImageMb={env.MAX_IMAGE_MB} maxVideoMb={env.MAX_VIDEO_MB} />
    </div>
  );
}
