import { AdminPosts, type AdminPost } from './AdminPosts';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminPostsPage() {
  const rows = await prisma.post.findMany({
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    include: { author: { select: { mcNickname: true } } },
  });

  const posts: AdminPost[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author.mcNickname ?? '-',
    tag: row.tag,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
    pinned: row.pinned,
    deleted: row.deletedAt !== null,
  }));

  return (
    <>
      <div className="section-title">
        <h2>Завозы</h2>
        <span className="faint">последние 200</span>
      </div>
      <AdminPosts posts={posts} />
    </>
  );
}
