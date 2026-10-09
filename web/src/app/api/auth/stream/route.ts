import { readBrowserToken } from '@/lib/session';
import { getPendingState } from '@/server/login';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 1500;
const MAX_LIFETIME_MS = 6 * 60 * 1000;

/**
 * Поток событий входа (SSE). Страница входа слушает его и, получив
 * «confirmed», дёргает /api/auth/finish: сессию создаёт уже он, потому что
 * заголовки Set-Cookie у потока уже отправлены.
 *
 * Состояние читается из базы, а не из памяти процесса: воркеров может быть
 * несколько, и подтверждение прилетит не обязательно в тот же самый.
 */
export async function GET(request: Request) {
  const browserToken = await readBrowserToken();

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // поток мог закрыться раньше со стороны клиента
        }
      };

      request.signal.addEventListener('abort', close);

      if (!browserToken) {
        send('error', { error: 'no_browser_token' });
        close();
        return;
      }

      const tick = async () => {
        if (closed) return;
        if (Date.now() - startedAt > MAX_LIFETIME_MS) {
          send('timeout', {});
          close();
          return;
        }
        try {
          const state = await getPendingState(browserToken);
          if (state.kind === 'confirmed') {
            send('confirmed', { source: state.source, purpose: state.purpose });
            close();
            return;
          }
          if (state.kind === 'expired') {
            send('expired', { source: state.source });
            close();
            return;
          }
          send('pending', {});
        } catch {
          send('error', { error: 'internal_error' });
          close();
        }
      };

      const timer = setInterval(tick, POLL_INTERVAL_MS);
      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
