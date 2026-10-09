import { z } from 'zod';

export const POST_TITLE_MAX = 120;
export const POST_BODY_MAX = 8000;
export const MAX_ATTACHMENTS = 4;

export const postTagSchema = z.enum(['STREAM', 'OFFSTREAM']);

export const postInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Заголовок короче трёх символов')
    .max(POST_TITLE_MAX, `Заголовок длиннее ${POST_TITLE_MAX} символов`),
  body: z
    .string()
    .trim()
    .min(1, 'Пустой текст')
    .max(POST_BODY_MAX, `Текст длиннее ${POST_BODY_MAX} символов`),
  tag: postTagSchema,
});

export const voteInputSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

export const nicknameSchema = z
  .string()
  .trim()
  .min(3, 'Ник короче трёх символов')
  .max(16, 'Ник длиннее 16 символов')
  .regex(/^[A-Za-z0-9_]+$/, 'В нике допустимы латиница, цифры и подчёркивание');

export const loginCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, 'Код состоит из шести символов');

export const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/,
    'Неверный UUID',
  );

/** Тело запроса от плагина Minecraft. */
export const mcConfirmSchema = z.object({
  code: loginCodeSchema,
  uuid: uuidSchema,
  nickname: nicknameSchema,
  textures: z.string().max(20000).optional().nullable(),
  serverName: z.string().max(64).optional().nullable(),
});

/** Тело запроса от Telegram-бота. */
export const tgConfirmSchema = z.object({
  token: z.string().trim().min(16).max(128),
  tgId: z.string().regex(/^\d{1,20}$/),
  username: z.string().trim().max(64).optional().nullable(),
  firstName: z.string().trim().max(128).optional().nullable(),
  photoUrl: z.string().url().max(512).optional().nullable(),
});

export const adminPlayerSchema = z.object({
  nickname: nicknameSchema,
  wikiText: z.string().max(20000).optional().nullable(),
  hidden: z.boolean().optional(),
});

export const archiveWeekSchema = z.object({
  number: z.coerce.number().int().min(0).max(9999),
  title: z.string().trim().min(1).max(160),
  summary: z.string().max(4000).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  published: z.boolean().optional(),
});

export const archiveItemSchema = z.object({
  weekId: z.string().min(1),
  kind: z.enum(['BUILD', 'ART', 'VIDEO', 'POST', 'LIFE']),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).optional().nullable(),
  url: z.string().url().max(512).optional().nullable(),
  authorNickname: z.string().max(16).optional().nullable(),
  order: z.coerce.number().int().min(0).max(9999).optional(),
});

export const mediaItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  url: z.string().url().max(512),
  description: z.string().max(2000).optional().nullable(),
  authorNickname: z.string().max(16).optional().nullable(),
  weekNumber: z.coerce.number().int().min(0).max(9999).optional().nullable(),
});

export const wikiArticleSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'В адресе допустимы строчные латинские буквы, цифры и дефис'),
  title: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(64),
  body: z.string().max(40000),
  published: z.boolean().optional(),
});

export const settingsSchema = z.object({
  projectStatus: z.enum(['RECRUITING', 'DEVELOPMENT', 'SEASON', 'PAUSED', 'CLOSED']).optional(),
  projectStatusNote: z.string().max(200).optional(),
  trailerUrl: z.string().max(512).optional(),
  trailerTitle: z.string().max(160).optional(),
  heroTagline: z.string().max(160).optional(),
  joinOpen: z.boolean().optional(),
  mapUrl: z.string().max(512).optional(),
  mapEnabled: z.boolean().optional(),
  serverAddress: z.string().max(200).optional(),
});

export const contentSchema = z.object({
  body: z.string().max(80000),
});

const pointCategory = z.enum(['EVENT', 'SOCIAL', 'COMMUNITY', 'CONTENT', 'VIEWS', 'REFERRAL', 'ADJUSTMENT']);
const hundredths = z.number().int().min(-100_000_000).max(100_000_000);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^https?:\/\//i.test(value), 'ссылка должна начинаться с http')
  .optional()
  .nullable();

export const pointsAwardSchema = z.object({
  userIds: z.array(z.string().min(1).max(40)).min(1).max(80),
  category: pointCategory,
  presetId: z.string().max(40).optional().nullable(),
  amount: hundredths,
  comment: z.string().max(1000),
  proofUrl: optionalUrl,
  postId: z.string().max(40).optional().nullable(),
  weekId: z.string().max(40).optional().nullable(),
  confirmOncePerSeason: z.boolean().optional(),
});

export const pointsRevertSchema = z.object({ reason: z.string().max(1000) });
export const pointsWithdrawSchema = z.object({ amount: hundredths });
export const pointsReferralSchema = z.object({ inviterUserId: z.string().max(40).nullable() });
export const pointsSeasonSchema = z.object({ title: z.string().max(80) });

export const pointsPresetSchema = z.object({
  category: pointCategory,
  title: z.string().trim().min(2).max(160),
  description: z.string().max(600).optional().nullable(),
  amount: hundredths.positive().nullable(),
  oncePerSeason: z.boolean().optional(),
  active: z.boolean().optional(),
  order: z.number().int().min(0).max(10000).optional(),
});
