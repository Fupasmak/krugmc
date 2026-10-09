import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentUser, isAdmin } from '@/lib/auth';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { PostForm } from '@/components/PostForm';
import { getTexts } from '@/server/texts';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTexts())['postEdit.title'], robots: { index: false } };
}

export const dynamic = 'force-dynamic';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, texts] = await Promise.all([currentUser(), getTexts()]);
  if (!user) redirect('/login');

  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true, body: true, tag: true, authorId: true },
  });
  if (!post) notFound();

  if (post.authorId !== user.id && !isAdmin(user)) redirect(`/posts/${id}`);

  return (
    <div className="container page">
      <div className="section-title">
        <h1>{texts['postEdit.title']}</h1>
      </div>

      <PostForm
        mode="edit"
        postId={post.id}
        initial={{ title: post.title, body: post.body, tag: post.tag }}
        maxImageMb={env.MAX_IMAGE_MB}
        maxVideoMb={env.MAX_VIDEO_MB}
      />
    </div>
  );
}
