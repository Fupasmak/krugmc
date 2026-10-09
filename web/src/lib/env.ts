import 'server-only';
import { z } from 'zod';

/**
 * Проверка переменных окружения при старте.
 * Если чего-то не хватает, падаем сразу с понятным списком, а не через час
 * в случайном месте.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),

  SITE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET: минимум 32 символа'),
  SUPERADMIN_NICKNAME: z.string().min(1).default('Fupasmak'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_IMAGE_MB: z.coerce.number().int().positive().default(5),
  MAX_VIDEO_MB: z.coerce.number().int().positive().default(200),

  FEATURE_CORNER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  FEATURE_TEAM: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  MC_HMAC_SECRET: z.string().min(32, 'MC_HMAC_SECRET: минимум 32 символа'),
  INTERNAL_API_SECRET: z.string().min(32, 'INTERNAL_API_SECRET: минимум 32 символа'),

  TG_BOT_USERNAME: z.string().min(1).default('KRUGSERVER_BOT'),
  TG_CHANNEL: z.string().min(1).default('@serverKRUG'),
  BOT_INTERNAL_URL: z.string().url().default('http://127.0.0.1:8081'),
  SUBSCRIPTION_CACHE_TTL: z.coerce.number().int().positive().default(600),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  throw new Error(
    `Переменные окружения заполнены неверно:\n${lines.join('\n')}\n` +
      'Смотри .env.example в корне проекта.',
  );
}

export const env = parsed.data;

/** Публичные значения, которые можно отдавать в браузер. */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? parsed.data.SITE_URL,
  telegramUrl: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? 'https://t.me/serverKRUG',
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL ?? 'https://discord.gg/3NDaxr6aQz',
  botUsername: parsed.data.TG_BOT_USERNAME,
  channel: parsed.data.TG_CHANNEL,
};
