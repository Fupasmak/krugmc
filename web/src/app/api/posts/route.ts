import { handler, jsonOk } from '@/lib/http';
import { currentUser, requirePlayer } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { parseUpload, deleteUpload } from '@/lib/uploads';
import { postInputSchema, postTagSchema, MAX_ATTACHMENTS } from '@/lib/validation';
import { createPost, listPosts, serializePost } from '@/server/posts';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Лента завозов. */
export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const tagParam = url.searchParams.get('tag');
  const tag = tagParam ? postTagSchema.parse(tagParam) : null;
  const cursor = url.searchParams.get('cursor');
  const author = url.searchParams.get('author');
  const limit = Number(url.searchParams.get('limit') ?? 10);

  let authorId: string | null = null;
  if (author) {
    const user = await prisma.user.findUnique({
      where: { mcNicknameLower: author.toLowerCase() },
      select: { id: true },
    });
    if (!user) return jsonOk({ posts: [], nextCursor: null });
    authorId = user.id;
  }

  const viewer = await currentUser();
  const { posts, nextCursor } = await listPosts({
    tag,
    cursor,
    authorId,
    limit: Number.isFinite(limit) ? limit : 10,
    viewerId: viewer?.id ?? null,
  });

  return jsonOk({ posts: posts.map(serializePost), nextCursor });
});

/** Новый завоз. Только игроки, только multipart (текст + до четырёх файлов). */
export const POST = handler(async (request) => {
  await assertCsrf(request);
  const author = await requirePlayer();

  await rateLimit({ key: `post:${author.id}`, ...LIMITS.createPost });
  await rateLimit({ key: `upload:${author.id}`, ...LIMITS.upload });

  const { fields, files } = await parseUpload(request, {
    maxFiles: MAX_ATTACHMENTS,
    allowVideo: true,
  });

  try {
    const input = postInputSchema.parse({
      title: fields.title ?? '',
      body: fields.body ?? '',
      tag: fields.tag ?? '',
    });

    // Размеры видео знает только браузер: он присылает их вместе с файлами
    let sizes: { index: number; width: number; height: number }[] = [];
    try {
      const parsed = JSON.parse(fields.sizes ?? '[]') as unknown;
      if (Array.isArray(parsed)) {
        sizes = parsed.filter(
          (item): item is { index: number; width: number; height: number } =>
            typeof item === 'object' &&
            item !== null &&
            Number.isInteger((item as { index: unknown }).index) &&
            Number.isInteger((item as { width: unknown }).width) &&
            Number.isInteger((item as { height: unknown }).height),
        );
      }
    } catch {
      sizes = [];
    }

    const attachments = files.map((file, index) => {
      const size = sizes.find((item) => item.index === index);
      return size && !file.width && !file.height
        ? { ...file, width: size.width, height: size.height }
        : file;
    });

    const postId = await createPost({
      author,
      title: input.title,
      body: input.body,
      tag: input.tag,
      attachments,
    });

    return jsonOk({ id: postId, redirect: `/posts/${postId}` }, { status: 201 });
  } catch (error) {
    // Завоз не создался, загруженные файлы не оставляем мусором.
    await Promise.all(files.map((file) => deleteUpload(file.path)));
    throw error;
  }
});
