import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import http from 'node:http';
import { env } from './env.js';
import { confirmToken } from './site-api.js';
import { startInternalServer, isSubscribed } from './internal-server.js';
import { syncAvatar } from './avatar.js';

const bot = new Bot(env.TG_BOT_TOKEN);

const SITE = env.SITE_URL.replace(/\/$/, '');

/** Подробные записи только в разработке. */
const devLog = (message: string, data?: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'production') return;
  console.log(`[bot] ${message}`, data ?? '');
};

// ---------------------------------------------------------------------------
//  Команды
// ---------------------------------------------------------------------------

bot.command('start', async (ctx) => {
  const payload = ctx.match?.trim() ?? '';

  devLog('пришла команда /start', {
    from: ctx.from?.id,
    payloadLength: payload.length,
    payload: payload ? `${payload.slice(0, 14)}...` : '(пусто)',
  });

  if (payload.startsWith('login_')) {
    const token = payload.slice('login_'.length);

    devLog('разобран deep-link', { tokenLength: token.length });

    if (!/^[a-f0-9]{16,128}$/.test(token)) {
      await ctx.reply('🔧 Ссылка приехала кривая. Начни вход заново на сайте: ' + SITE);
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('Подтвердить вход', `ok:login:${token}`)
      .row()
      .text('Отмена', 'cancel');

    await ctx.reply(`🟢 Вход на ${SITE}\n\nПодтверждаешь, что это ты, а не сосед?`, {
      reply_markup: keyboard,
    });
    return;
  }

  await ctx.reply(
    '🟩 KRUG: создаём круг там, где квадрат.\n\n' +
      `Сайт: ${SITE}\n` +
      `Канал: ${env.TG_CHANNEL}\n\n` +
      'Хочешь смотреть и голосовать за завозы: нажми на сайте «Войти через Telegram», ' +
      'я пришлю кнопку подтверждения.\n' +
      'Голоса считаются только у подписчиков канала. Такая вот круглая душниловка, ' +
      'зато без накруток.',
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '📋 Что я умею:\n' +
      '• подтверждаю вход на сайт по ссылке оттуда же;\n' +
      `• проверяю подписку на ${env.TG_CHANNEL}, когда ты голосуешь.\n\n` +
      `Сайт: ${SITE}\n` +
      'Больше ничего не умею и не набиваюсь.',
  );
});

bot.command('status', async (ctx) => {
  if (!ctx.from) return;
  try {
    const subscribed = await isSubscribed(bot, BigInt(ctx.from.id));
    await ctx.reply(
      subscribed
        ? `✅ Подписка на ${env.TG_CHANNEL} на месте. Голосуй на здоровье.`
        : `🔕 Подписки на ${env.TG_CHANNEL} не вижу. Подпишись и жми на сайте «Я подписался, проверить».`,
    );
  } catch {
    await ctx.reply('⚠️ Не вышло проверить подписку. Попробуй через минуту.');
  }
});

// ---------------------------------------------------------------------------
//  Кнопки подтверждения
// ---------------------------------------------------------------------------

bot.callbackQuery('cancel', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText('Отменили. Ничего не случилось.');
});

bot.callbackQuery(/^ok:login:([a-f0-9]{16,128})$/, async (ctx) => {
  const [, token] = ctx.match as RegExpMatchArray;
  const from = ctx.from;

  await ctx.answerCallbackQuery();

  const result = await confirmToken({
    token,
    tgId: from.id,
    username: from.username ?? null,
    firstName: from.first_name ?? null,
  });

  devLog('ответ сайта на подтверждение', {
    ok: result.ok,
    error: result.ok ? null : result.error,
  });

  if (!result.ok) {
    await ctx.editMessageText(`Не вышло. ${result.message}`);
    return;
  }

  // Аватар подтягиваем уже после подтверждения, чтобы не задерживать вход.
  void syncAvatar(bot, from.id);

  let tail = '';
  try {
    tail = (await isSubscribed(bot, BigInt(from.id)))
      ? '\n\nПодписка на канал на месте, голоса засчитаются.'
      : `\n\nГолосуют только свои: подпишись на ${env.TG_CHANNEL} и возвращайся круглым.`;
  } catch {
    tail = '';
  }

  await ctx.editMessageText(`🟢 Вход подтверждён. Возвращайся на сайт, страница обновится сама.${tail}`);
});

bot.catch((error) => {
  console.error('[bot] ошибка обработчика:', error.error);
});

// ---------------------------------------------------------------------------
//  Запуск
// ---------------------------------------------------------------------------

async function main() {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Начать' },
    { command: 'status', description: 'Проверить подписку на канал' },
    { command: 'help', description: 'Что я умею' },
  ]);

  const internal = startInternalServer(bot);

  const me = await bot.api.getMe();
  console.log(`[bot] запущен как @${me.username}, канал ${env.TG_CHANNEL}`);
  console.log(`[bot] сайт для внутренних вызовов: ${env.SITE_INTERNAL_URL}`);

  // Если у бота остался webhook, обновления уйдут туда, а не сюда.
  const hook = await bot.api.getWebhookInfo();
  if (hook.url) {
    console.warn(`[bot] висит webhook ${hook.url}, в режиме polling он мешает`);
  }

  if (env.BOT_MODE === 'webhook') {
    const handle = webhookCallback(bot, 'http');
    const server = http.createServer(async (req, res) => {
      if (req.method !== 'POST' || req.url !== '/tg/webhook') {
        res.writeHead(404).end();
        return;
      }
      if (req.headers['x-telegram-bot-api-secret-token'] !== env.BOT_WEBHOOK_SECRET) {
        res.writeHead(401).end();
        return;
      }
      await handle(req, res);
    });

    server.listen(env.BOT_WEBHOOK_PORT, async () => {
      await bot.api.setWebhook(env.BOT_WEBHOOK_URL!, {
        secret_token: env.BOT_WEBHOOK_SECRET!,
        drop_pending_updates: true,
      });
      console.log(`[bot] webhook на ${env.BOT_WEBHOOK_URL}, порт ${env.BOT_WEBHOOK_PORT}`);
    });

    shutdownOn([internal, server]);
    return;
  }

  await bot.api.deleteWebhook({ drop_pending_updates: true });
  shutdownOn([internal]);
  await bot.start({ onStart: () => console.log('[bot] long polling пошёл') });
}

function shutdownOn(servers: http.Server[]) {
  const stop = async (signal: string) => {
    console.log(`[bot] ${signal}, останавливаюсь`);
    await bot.stop();
    for (const server of servers) server.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

main().catch((error) => {
  console.error('[bot] не удалось запуститься:', error);
  process.exit(1);
});
