import 'server-only';
import { Prisma, type PostTag, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, forbidden, notFound } from '@/lib/http';
import { MAX_ATTACHMENTS } from '@/lib/validation';

export const POSTS_PAGE_SIZE = 10;

/**
 * ТОП ЗАВОЗ: свежий завоз с высоким рейтингом поднимается над лентой.
 * Считается итоговый рейтинг (плюсы минус минусы), окно 24 часа.
 * Через сутки завоз возвращается на своё место по дате.
 */
export const TOP_POST_MIN_SCORE = 10;
export const TOP_POST_WINDOW_HOURS = 24;

export function topPostWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - TOP_POST_WINDOW_HOURS * 60 * 60 * 1000);
}

const postInclude = {
  author: {
    select: {
      id: true,
      mcNickname: true,
      mcNicknameLower: true,
      mcUuid: true,
      cardFile: true,
      type: true,
      tgFirstName: true,
      tgUsername: true,
    },
  },
  attachments: { orderBy: { order: 'asc' } },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export type FeedPost = PostWithRelations & {
  /** Голос текущего пользователя: 1, -1 или null */
  myVote: number | null;
  /** Завоз сейчас в топе ленты */
  hot: boolean;
};

/** Условие «этот завоз сейчас топовый». */
export function isHotPost(post: { score: number; createdAt: Date }, now = new Date()): boolean {
  return post.score > TOP_POST_MIN_SCORE && post.createdAt >= topPostWindowStart(now);
}

export async function listPosts(params: {
  tag?: PostTag | null;
  authorId?: string | null;
  cursor?: string | null;
  limit?: number;
  viewerId?: string | null;
}): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? POSTS_PAGE_SIZE, 30);

  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    ...(params.tag ? { tag: params.tag } : {}),
    ...(params.authorId ? { authorId: params.authorId } : {}),
  };

  const rows = await prisma.post.findMany({
    where,
    include: postInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const myVotes = new Map<string, number>();
  if (params.viewerId && page.length > 0) {
    const votes = await prisma.vote.findMany({
      where: { userId: params.viewerId, postId: { in: page.map((p) => p.id) } },
      select: { postId: true, value: true },
    });
    for (const vote of votes) myVotes.set(vote.postId, vote.value);
  }

  const now = new Date();

  return {
    posts: page.map((post) => ({
      ...post,
      myVote: myVotes.get(post.id) ?? null,
      hot: isHotPost(post, now),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

/**
 * Лента со страницами: /posts?page=2.
 *
 * Порядок: закреплённые, потом топ-завозы за сутки (по рейтингу, при
 * равенстве по дате), дальше всё остальное по дате. Сортировка считается
 * на сервере, фронт получает готовый порядок.
 */
export async function listPostsPage(params: {
  page: number;
  tag?: PostTag | null;
  authorId?: string | null;
  viewerId?: string | null;
  pageSize?: number;
}): Promise<{ posts: FeedPost[]; total: number; pages: number; page: number }> {
  const pageSize = params.pageSize ?? POSTS_PAGE_SIZE;
  const page = Math.max(1, params.page);
  const now = new Date();

  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    ...(params.tag ? { tag: params.tag } : {}),
    ...(params.authorId ? { authorId: params.authorId } : {}),
  };

  const hotWhere: Prisma.PostWhereInput = {
    ...where,
    pinned: false,
    createdAt: { gte: topPostWindowStart(now) },
    score: { gt: TOP_POST_MIN_SCORE },
  };

  const [total, pinnedRows, hotRows] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where: { ...where, pinned: true },
      include: postInclude,
      orderBy: [{ createdAt: 'desc' }],
    }),
    prisma.post.findMany({
      where: hotWhere,
      include: postInclude,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  // Верх ленты: закреплённые, затем топовые. Остальное идёт по дате.
  const head = [...pinnedRows, ...hotRows];
  const headIds = head.map((post) => post.id);

  const start = (page - 1) * pageSize;
  const fromHead = head.slice(start, start + pageSize);
  const restNeeded = pageSize - fromHead.length;
  const restSkip = Math.max(0, start - head.length);

  const restRows =
    restNeeded > 0
      ? await prisma.post.findMany({
          where: headIds.length > 0 ? { ...where, id: { notIn: headIds } } : where,
          include: postInclude,
          orderBy: [{ createdAt: 'desc' }],
          skip: restSkip,
          take: restNeeded,
        })
      : [];

  const rows = [...fromHead, ...restRows];

  const myVotes = new Map<string, number>();
  if (params.viewerId && rows.length > 0) {
    const votes = await prisma.vote.findMany({
      where: { userId: params.viewerId, postId: { in: rows.map((row) => row.id) } },
      select: { postId: true, value: true },
    });
    for (const vote of votes) myVotes.set(vote.postId, vote.value);
  }

  return {
    posts: rows.map((post) => ({
      ...post,
      myVote: myVotes.get(post.id) ?? null,
      hot: isHotPost(post, now),
    })),
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    page,
  };
}

export async function getPost(id: string, viewerId?: string | null): Promise<FeedPost | null> {
  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: postInclude,
  });
  if (!post) return null;

  let myVote: number | null = null;
  if (viewerId) {
    const vote = await prisma.vote.findUnique({
      where: { postId_userId: { postId: id, userId: viewerId } },
      select: { value: true },
    });
    myVote = vote?.value ?? null;
  }
  return { ...post, myVote, hot: isHotPost(post) };
}

export async function createPost(params: {
  author: User;
  title: string;
  body: string;
  tag: PostTag;
  attachments: {
    kind: 'IMAGE' | 'VIDEO';
    path: string;
    mime: string;
    size: number;
    width: number | null;
    height: number | null;
  }[];
}): Promise<string> {
  if (params.attachments.length > MAX_ATTACHMENTS) {
    throw badRequest('too_many_files', `Можно приложить не больше ${MAX_ATTACHMENTS} файлов`);
  }

  const post = await prisma.post.create({
    data: {
      authorId: params.author.id,
      title: params.title,
      body: params.body,
      tag: params.tag,
      attachments: {
        create: params.attachments.map((file, index) => ({
          kind: file.kind,
          path: file.path,
          mime: file.mime,
          size: file.size,
          width: file.width,
          height: file.height,
          order: index,
        })),
      },
    },
    select: { id: true },
  });

  return post.id;
}

export async function updatePost(params: {
  postId: string;
  editor: User;
  title: string;
  body: string;
  tag: PostTag;
}) {
  const post = await prisma.post.findFirst({
    where: { id: params.postId, deletedAt: null },
    select: { authorId: true },
  });
  if (!post) throw notFound('Такого завоза нет');

  const isOwner = post.authorId === params.editor.id;
  const isStaff = params.editor.role === 'ADMIN' || params.editor.role === 'SUPERADMIN';
  if (!isOwner && !isStaff) throw forbidden('Чужой завоз трогать нельзя');

  await prisma.post.update({
    where: { id: params.postId },
    data: {
      title: params.title,
      body: params.body,
      tag: params.tag,
      editedAt: new Date(),
    },
  });
}

export async function deletePost(params: { postId: string; actor: User }) {
  const post = await prisma.post.findFirst({
    where: { id: params.postId, deletedAt: null },
    select: { authorId: true },
  });
  if (!post) throw notFound('Такого завоза нет');

  const isOwner = post.authorId === params.actor.id;
  const isStaff = params.actor.role === 'ADMIN' || params.actor.role === 'SUPERADMIN';
  if (!isOwner && !isStaff) throw forbidden('Чужой завоз трогать нельзя');

  // Мягкое удаление: файлы остаются на диске, запись пропадает из ленты.
  await prisma.post.update({
    where: { id: params.postId },
    data: { deletedAt: new Date() },
  });
}

export type VoteResult = {
  upCount: number;
  downCount: number;
  score: number;
  myVote: number;
};

/**
 * Голос неизменяемый: уникальный индекс (postId, userId) плюс явная проверка.
 * Счётчики меняются в той же транзакции, что и запись голоса.
 */
export async function castVote(params: {
  postId: string;
  user: User;
  value: 1 | -1;
}): Promise<VoteResult> {
  const post = await prisma.post.findFirst({
    where: { id: params.postId, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!post) throw notFound('Такого завоза нет');
  if (post.authorId === params.user.id) {
    throw forbidden('За свой завоз голосовать нельзя, даже если он хорош');
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.vote.create({
        data: { postId: params.postId, userId: params.user.id, value: params.value },
      });
      return tx.post.update({
        where: { id: params.postId },
        data:
          params.value === 1
            ? { upCount: { increment: 1 }, score: { increment: 1 } }
            : { downCount: { increment: 1 }, score: { decrement: 1 } },
        select: { upCount: true, downCount: true, score: true },
      });
    });

    return { ...updated, myVote: params.value };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw badRequest('already_voted', 'Голос уже учтён. Передумать нельзя, мы тут без острых углов');
    }
    throw error;
  }
}

/** Топ авторов за последние дни, блок «Завозчики недели» на главной. */
export async function topAuthors(days = 7, limit = 3) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await prisma.post.groupBy({
    by: ['authorId'],
    where: { deletedAt: null, createdAt: { gte: since } },
    _sum: { score: true },
    _count: { _all: true },
    orderBy: [{ _sum: { score: 'desc' } }, { _count: { authorId: 'desc' } }],
    take: limit,
  });

  if (grouped.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.authorId) } },
    select: {
      id: true,
      mcNickname: true,
      mcNicknameLower: true,
      mcUuid: true,
      cardFile: true,
    },
  });

  return grouped
    .map((row) => {
      const user = users.find((u) => u.id === row.authorId);
      if (!user) return null;
      return {
        user,
        score: row._sum.score ?? 0,
        posts: row._count._all,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

/** Форма завоза для ответов API. */
export function serializePost(post: FeedPost) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    tag: post.tag,
    pinned: post.pinned,
    upCount: post.upCount,
    downCount: post.downCount,
    score: post.score,
    myVote: post.myVote,
    hot: post.hot,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt?.toISOString() ?? null,
    author: {
      nickname: post.author.mcNickname,
      slug: post.author.mcNicknameLower,
      uuid: post.author.mcUuid,
    },
    attachments: post.attachments.map((file) => ({
      id: file.id,
      kind: file.kind,
      url: `/uploads/${file.path}`,
      mime: file.mime,
      width: file.width,
      height: file.height,
    })),
  };
}
