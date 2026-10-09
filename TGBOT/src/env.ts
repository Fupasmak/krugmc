import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// .env лежит в корне монорепо, рядом с docker-compose.yml
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, '../../.env') });
config();

const schema = z.object({
  TG_BOT_TOKEN: z.string().min(20, 'TG_BOT_TOKEN: похоже, токен не заполнен'),
  TG_BOT_USERNAME: z.string().min(1).default('KRUGSERVER_BOT'),
  TG_CHANNEL: z.string().min(1).default('@serverKRUG'),

  SITE_URL: z.string().url().default('http://localhost:3000'),
  SITE_INTERNAL_URL: z.string().url().default('http://127.0.0.1:3000'),
  INTERNAL_API_SECRET: z.string().min(32, 'INTERNAL_API_SECRET: минимум 32 символа'),

  BOT_INTERNAL_PORT: z.coerce.number().int().positive().default(8081),
  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  BOT_WEBHOOK_URL: z.string().url().optional(),
  BOT_WEBHOOK_PORT: z.coerce.number().int().positive().default(8443),
  BOT_WEBHOOK_SECRET: z.string().min(16).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`Переменные окружения бота заполнены неверно:\n${lines.join('\n')}`);
  process.exit(1);
}

if (parsed.data.BOT_MODE === 'webhook' && (!parsed.data.BOT_WEBHOOK_URL || !parsed.data.BOT_WEBHOOK_SECRET)) {
  console.error('BOT_MODE=webhook требует BOT_WEBHOOK_URL и BOT_WEBHOOK_SECRET');
  process.exit(1);
}

export const env = parsed.data;
