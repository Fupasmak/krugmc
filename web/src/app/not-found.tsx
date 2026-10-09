import Link from 'next/link';
import { getTexts } from '@/server/texts';
import { SiteTextView } from '@/components/SiteTextView';

export const metadata = {
  title: 'Тут острый угол',
  robots: { index: false },
};

export default async function NotFound() {
  const texts = await getTexts();

  return (
    <div
      className="container page"
      style={{
        display: 'grid',
        gap: 'var(--gap-xl)',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
      }}
    >
      <div className="stack">
        <span className="kicker">{texts['notFound.kicker']}</span>
        <h1 className="accent-type">{texts['notFound.title']}</h1>
        <div className="muted" style={{ maxWidth: '50ch' }}>
          <SiteTextView as="p" value={texts['notFound.text']} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--gap-sm)', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn--grass">
            {texts['notFound.home']}
          </Link>
          <Link href="/posts" className="btn btn--stone">
            {texts['notFound.posts']}
          </Link>
        </div>
      </div>

      <img
        src="/blocks/3d/bedrock.png"
        alt=""
        width={180}
        height={180}
        style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 14px 22px rgba(0,0,0,.5))' }}
      />
    </div>
  );
}
