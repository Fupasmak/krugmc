import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { publicEnv } from '@/lib/env';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl.replace(/\/$/, '');

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/posts`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/players`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/archive`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/zero`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/join`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/media`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/points`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  if (env.FEATURE_CORNER) {
    staticPages.push({ url: `${base}/corner`, changeFrequency: 'monthly', priority: 0.5 });
  }

  try {
    const [posts, players, weeks] = await Promise.all([
      prisma.post.findMany({
        where: { deletedAt: null },
        select: { id: true, createdAt: true, editedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.user.findMany({
        where: { type: 'MC', hidden: false },
        select: { mcNicknameLower: true, updatedAt: true },
        take: 500,
      }),
      prisma.archiveWeek.findMany({
        where: { published: true },
        select: { number: true, endsAt: true },
      }),
    ]);

    return [
      ...staticPages,
      ...posts.map((post) => ({
        url: `${base}/posts/${post.id}`,
        lastModified: post.editedAt ?? post.createdAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...players
        .filter((player) => player.mcNicknameLower)
        .map((player) => ({
          url: `${base}/players/${player.mcNicknameLower}`,
          lastModified: player.updatedAt,
          changeFrequency: 'weekly' as const,
          priority: 0.5,
        })),
      ...weeks.map((week) => ({
        url: `${base}/archive/week/${week.number}`,
        lastModified: week.endsAt,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
    ];
  } catch {
    // Если база недоступна, отдаём хотя бы статические адреса.
    return staticPages;
  }
}
