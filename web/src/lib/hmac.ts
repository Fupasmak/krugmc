import 'server-only';
import crypto from 'node:crypto';
import { prisma } from './prisma';

/**
 * Подпись внутренних запросов: плагин -> сайт, бот -> сайт, сайт -> бот.
 *
 * Подписывается строка:  <timestamp>.<nonce>.<тело запроса как есть>
 * Алгоритм: HMAC-SHA256, результат в hex.
 *
 * Заголовки:
 *   X-KRUG-Timestamp: unix-время в секундах
 *   X-KRUG-Nonce: случайная строка, один раз на запрос
 *   X-KRUG-Signature: подпись
 *
 * Формат полностью описан в API.md.
 */

export const SIGNATURE_WINDOW_SECONDS = 60;

export function buildSignature(secret: string, timestamp: string, nonce: string, body: string) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest('hex');
}

export function signHeaders(secret: string, body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  return {
    'Content-Type': 'application/json',
    'X-KRUG-Timestamp': timestamp,
    'X-KRUG-Nonce': nonce,
    'X-KRUG-Signature': buildSignature(secret, timestamp, nonce, body),
  };
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export type VerifyResult =
  | { ok: true; body: string }
  | { ok: false; status: number; error: string };

/**
 * Проверяет подпись входящего запроса и защищает от повтора (replay):
 * nonce одноразовый, время запроса должно попадать в окно.
 */
export async function verifySignedRequest(
  request: Request,
  secret: string,
  scope: 'mc' | 'bot',
): Promise<VerifyResult> {
  const timestamp = request.headers.get('x-krug-timestamp');
  const nonce = request.headers.get('x-krug-nonce');
  const signature = request.headers.get('x-krug-signature');

  if (!timestamp || !nonce || !signature) {
    return { ok: false, status: 401, error: 'missing_signature_headers' };
  }
  if (!/^\d{1,12}$/.test(timestamp) || !/^[a-f0-9]{16,64}$/i.test(nonce)) {
    return { ok: false, status: 401, error: 'malformed_signature_headers' };
  }

  const now = Math.floor(Date.now() / 1000);
  const drift = Math.abs(now - Number(timestamp));
  if (drift > SIGNATURE_WINDOW_SECONDS) {
    return { ok: false, status: 401, error: 'timestamp_out_of_window' };
  }

  const body = await request.text();
  const expected = buildSignature(secret, timestamp, nonce, body);
  if (!safeEqual(expected, signature)) {
    return { ok: false, status: 401, error: 'bad_signature' };
  }

  try {
    await prisma.usedNonce.create({ data: { nonce: `${scope}:${nonce}`, scope } });
  } catch {
    return { ok: false, status: 401, error: 'nonce_reused' };
  }

  // Подчищаем протухшие nonce, чтобы таблица не росла бесконечно.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - SIGNATURE_WINDOW_SECONDS * 2000);
    await prisma.usedNonce.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }

  return { ok: true, body };
}
