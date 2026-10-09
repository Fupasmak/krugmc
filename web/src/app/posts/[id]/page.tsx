import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { currentUser, isAdmin } from '@/lib/auth';
import { getPost } from '@/server/posts';
import { voteAccess } from '@/lib/vote-access';
import { plainExcerpt } from '@/lib/markdown';
import { getTexts } from '@/server/texts';
import { fillText } from '@/lib/site-texts';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: (await getTexts())['post.notFound'] };

  return {
    title: post.title,
    description: plainExcerpt(post.body, 160),
    openGraph: {
      title: post.title,
      description: plainExcerpt(post.body, 160),
      type: 'article',
      publishedTime: post.createdAt.toISOString(),
      authors: post.author.mcNickname ? [post.author.mcNickname] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [viewer, texts] = await Promise.all([currentUser(), getTexts()]);
  const post = await getPost(id, viewer?.id ?? null);
  if (!post) notFound();

  const staff = isAdmin(viewer);

  return (
    <div className="container page">
      <div className={'section-title'}>
        <Link href="/posts" className="btn btn--ghost btn--sm">
          {texts['post.back']}
        </Link>
      </div>

      <PostCard
        post={post}
        access={voteAccess(viewer, post.authorId)}
        canManage={Boolean(viewer && (viewer.id === post.authorId || staff))}
        full
      />

      <div style={{ marginTop: 'var(--gap-lg)' }}>
        <Link href={`/players/${post.author.mcNicknameLower ?? ''}`} className="btn btn--stone btn--sm">
          {fillText(texts['post.authorAll'], { nick: post.author.mcNickname ?? '' })}
        </Link>
      </div>
    </div>
  );
}
