'use client';

/** Помощники для запросов из браузера: CSRF-токен и разбор ошибок. */

export function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)krug_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

export async function apiFetch<T extends Json = Json>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-CSRF-Token', csrfToken());
    if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });

  let data: Json = {};
  try {
    data = (await response.json()) as Json;
  } catch {
    data = {};
  }

  if (!response.ok || data.ok === false) {
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'request_failed',
      typeof data.message === 'string' ? data.message : 'Запрос не прошёл',
      response.status,
    );
  }

  return data as T;
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Что-то пошло не так';
}
