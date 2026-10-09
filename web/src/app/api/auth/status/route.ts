import { handler, jsonOk } from '@/lib/http';
import { readBrowserToken } from '@/lib/session';
import { getPendingState } from '@/server/login';

export const dynamic = 'force-dynamic';

/** Запасной путь к статусу входа, если SSE не работает (старый прокси и т.п.). */
export const GET = handler(async () => {
  const browserToken = await readBrowserToken();
  if (!browserToken) return jsonOk({ state: 'none' });

  const state = await getPendingState(browserToken);
  return jsonOk({
    state: state.kind,
    source: 'source' in state ? state.source : null,
    purpose: 'purpose' in state ? state.purpose : null,
    expiresAt: 'expiresAt' in state ? state.expiresAt.toISOString() : null,
  });
});
