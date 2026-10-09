import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { LoginPanel } from '@/components/LoginPanel';
import { publicEnv } from '@/lib/env';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getTexts();
  return { title: texts['login.title'], description: texts['login.description'], robots: { index: false } };
}

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const [user, texts] = await Promise.all([currentUser(), getTexts()]);
  if (user) redirect(user.type === 'MC' ? '/me' : '/posts');

  return (
    <div className="container page">
      <div className="section-title">
        <h1>{texts['login.title']}</h1>
      </div>
      <div className="muted" style={{ maxWidth: '64ch', marginBottom: 'var(--gap-lg)' }}>
        <SiteTextView as="p" value={texts['login.lead']} />
      </div>

      <LoginPanel channel={publicEnv.channel} />
    </div>
  );
}
