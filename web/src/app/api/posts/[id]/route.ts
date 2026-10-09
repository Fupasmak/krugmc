import { handler, jsonOk, notFound } from '@/lib/http';
import { currentUser, requireUser } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { postInputSchema } from '@/lib/validation';
import { deletePost, getPost, serializePost, updatePost } from '@/server/posts';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = handler(async (_request, context: Context) => {
  const { id } = await context.params;
  const viewer = await currentUser();
  const post = await getPost(id, viewer?.id ?? null);
  if (!post) throw notFound('Завоз не найден');
  return jsonOk({ post: serializePost(post) });
});

/** Правка своего завоза. Внизу появится пометка «изменено». */
export const PATCH = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const user = await requireUser();
  const { id } = await context.params;

  await rateLimit({ key: `post-edit:${user.id}`, ...LIMITS.editPost });

  const input = postInputSchema.parse(await request.json());
  await updatePost({ postId: id, editor: user, ...input });

  const post = await getPost(id, user.id);
  if (!post) throw notFound('Завоз не найден');
  return jsonOk({ post: serializePost(post) });
});

export const DELETE = handler(async (request, context: Context) => {
  await assertCsrf(request);
  const user = await requireUser();
  const { id } = await context.params;

  await deletePost({ postId: id, actor: user });
  return jsonOk({ deleted: true });
});
