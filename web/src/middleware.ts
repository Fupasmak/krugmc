import { NextResponse, type NextRequest } from 'next/server';

/**
 * Выдаёт двe служебные cookie всем посетителям:
 *  - krug_browser: метка браузера, к ней привязывается код входа;
 *  - krug_csrf: токен для защиты изменяющих запросов (double submit),
 *    поэтому он намеренно доступен скриптам.
 *
 * Обе нужны ещё до входа, а cookie в App Router ставятся только в middleware,
 * route handler или server action, при рендере страницы нельзя.
 */

const BROWSER_COOKIE = 'krug_browser';
const CSRF_COOKIE = 'krug_csrf';
const YEAR = 60 * 60 * 24 * 365;

function randomHex(bytes: number) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function middleware(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  const requestHeaders = new Headers(request.headers);

  const browser = request.cookies.get(BROWSER_COOKIE)?.value;
  const csrf = request.cookies.get(CSRF_COOKIE)?.value;

  const nextBrowser = browser && /^[a-f0-9]{32,64}$/.test(browser) ? null : randomHex(24);
  const nextCsrf = csrf && /^[a-f0-9]{32,64}$/.test(csrf) ? null : randomHex(24);

  if (nextBrowser || nextCsrf) {
    // Чтобы обработчик этого же запроса уже видел новые значения.
    const jar = [
      `${BROWSER_COOKIE}=${nextBrowser ?? browser}`,
      `${CSRF_COOKIE}=${nextCsrf ?? csrf}`,
    ];
    const existing = requestHeaders.get('cookie');
    requestHeaders.set('cookie', existing ? `${existing}; ${jar.join('; ')}` : jar.join('; '));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (nextBrowser) {
    response.cookies.set(BROWSER_COOKIE, nextBrowser, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: YEAR,
    });
  }
  if (nextCsrf) {
    response.cookies.set(CSRF_COOKIE, nextCsrf, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: YEAR,
    });
  }

  return response;
}

export const config = {
  // Служебные cookie не нужны статике и внутренним вызовам от плагина и бота.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/mc/|api/internal/|uploads/).*)'],
};
