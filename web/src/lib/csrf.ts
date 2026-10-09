import 'server-only';
import { cookies } from 'next/headers';
import { CSRF_COOKIE } from './session';
import { env } from './env';
import { forbidden } from './http';

/**
 * Защита от CSRF двумя рубежами:
 *  1. Origin/Referer запроса должен совпадать с адресом сайта.
 *  2. Заголовок X-CSRF-Token должен совпадать с cookie krug_csrf
 *     (double submit: злоумышленник с чужого домена cookie не прочитает).
 */
export async function assertCsrf(request: Request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const origin = request.headers.get('origin') ?? request.headers.get('referer');
  if (origin) {
    let sameSite = false;
    try {
      sameSite = new URL(origin).origin === new URL(env.SITE_URL).origin;
    } catch {
      sameSite = false;
    }
    // В разработке сайт открывают и как localhost, и как 127.0.0.1
    if (!sameSite && process.env.NODE_ENV !== 'production') {
      try {
        sameSite = new URL(origin).hostname === 'localhost' || new URL(origin).hostname === '127.0.0.1';
      } catch {
        sameSite = false;
      }
    }
    if (!sameSite) throw forbidden('Запрос пришёл с чужого домена, так не пойдёт');
  }

  const header = request.headers.get('x-csrf-token');
  const cookie = (await cookies()).get(CSRF_COOKIE)?.value;
  if (!header || !cookie || header !== cookie) {
    throw forbidden('Сессия протухла. Обнови страницу и повтори');
  }
}
