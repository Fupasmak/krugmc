import crypto from 'node:crypto';
import { env } from './env.js';

/**
 * Вызовы сайта подписываются HMAC-SHA256 по строке
 *   <timestamp>.<nonce>.<тело>
 * Формат общий для плагина и бота, описан в API.md.
 */

export function signHeaders(body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', env.INTERNAL_API_SECRET)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-KRUG-Timestamp': timestamp,
    'X-KRUG-Nonce': nonce,
    'X-KRUG-Signature': signature,
  };
}

export type ConfirmResult =
  | { ok: true; purpose: 'LOGIN'; message: string; nickname?: string | null }
  | { ok: false; error: string; message: string };

export async function confirmToken(params: {
  token: string;
  tgId: number | bigint;
  username?: string | null;
  firstName?: string | null;
}): Promise<ConfirmResult> {
  const body = JSON.stringify({
    token: params.token,
    tgId: params.tgId.toString(),
    username: params.username ?? null,
    firstName: params.firstName ?? null,
  });

  const url = `${env.SITE_INTERNAL_URL}/api/internal/tg/confirm`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: signHeaders(body),
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[bot] запрос подтверждения', { url, status: response.status });
    }

    const data = (await response.json()) as ConfirmResult;
    return data;
  } catch (error) {
    console.warn('[bot] сайт не ответил', { url, error: String(error) });
    return {
      ok: false,
      error: 'site_unreachable',
      message: 'Связь с сайтом пошла квадратно. Попробуй через минуту.',
    };
  }
}

export async function uploadAvatar(params: {
  tgId: number | bigint;
  photo: Buffer;
  mime: string;
}): Promise<boolean> {
  const body = JSON.stringify({
    tgId: params.tgId.toString(),
    mime: params.mime,
    data: params.photo.toString('base64'),
  });

  try {
    const response = await fetch(`${env.SITE_INTERNAL_URL}/api/internal/tg/avatar`, {
      method: 'POST',
      headers: signHeaders(body),
      body,
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
