import crypto from 'node:crypto';
import http from 'node:http';
import type { Bot } from 'grammy';
import { env } from './env.js';

/**
 * Внутренний HTTP-сервер бота.
 * Сайт спрашивает у него «подписан ли этот человек на канал»: токен бота
 * живёт только здесь, наружу он не уезжает.
 *
 * Запросы подписаны тем же HMAC, что и всё внутреннее взаимодействие.
 */

const WINDOW_SECONDS = 60;
const usedNonces = new Map<string, number>();

function checkSignature(headers: http.IncomingHttpHeaders, body: string): boolean {
  const timestamp = headers['x-krug-timestamp'];
  const nonce = headers['x-krug-nonce'];
  const signature = headers['x-krug-signature'];

  if (typeof timestamp !== 'string' || typeof nonce !== 'string' || typeof signature !== 'string') {
    return false;
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > WINDOW_SECONDS) return false;

  const cutoff = Date.now() - WINDOW_SECONDS * 2000;
  for (const [key, time] of usedNonces) {
    if (time < cutoff) usedNonces.delete(key);
  }
  if (usedNonces.has(nonce)) return false;

  const expected = crypto
    .createHmac('sha256', env.INTERNAL_API_SECRET)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  usedNonces.set(nonce, Date.now());
  return true;
}

const SUBSCRIBED_STATUSES = new Set(['creator', 'administrator', 'member']);

export async function isSubscribed(bot: Bot, tgId: bigint): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(env.TG_CHANNEL, Number(tgId));
    if (member.status === 'restricted') {
      return 'is_member' in member ? Boolean(member.is_member) : false;
    }
    return SUBSCRIBED_STATUSES.has(member.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // «user not found» значит, что человек на канал не подписан
    if (message.includes('user not found') || message.includes('PARTICIPANT_ID_INVALID')) {
      return false;
    }
    throw error;
  }
}

export function startInternalServer(bot: Bot) {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        res.writeHead(413).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method !== 'POST' || req.url !== '/internal/subscription') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'not_found' }));
        return;
      }

      if (!checkSignature(req.headers, body)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'bad_signature' }));
        return;
      }

      try {
        const data = JSON.parse(body) as { tgId?: string };
        if (!data.tgId || !/^\d{1,20}$/.test(data.tgId)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'bad_tg_id' }));
          return;
        }

        const subscribed = await isSubscribed(bot, BigInt(data.tgId));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, subscribed }));
      } catch (error) {
        console.error('[bot] проверка подписки не удалась:', error);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'telegram_error' }));
      }
    });
  });

  server.listen(env.BOT_INTERNAL_PORT, () => {
    console.log(`[bot] внутренний сервер слушает порт ${env.BOT_INTERNAL_PORT}`);
  });

  return server;
}
