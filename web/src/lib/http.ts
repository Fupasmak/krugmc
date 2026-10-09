import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** Ошибка, которую можно безопасно показать пользователю. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const unauthorized = (message = 'Тут только для своих, сначала войди') =>
  new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'Прав не хватает') => new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Не нашли такого') => new ApiError(404, 'not_found', message);
export const tooMany = (message: string) => new ApiError(429, 'rate_limited', message);

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: error.code, message: error.message },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: 'validation_failed',
        message: first ? `${first.path.join('.')}: ${first.message}` : 'Данные не подошли',
      },
      { status: 400 },
    );
  }
  console.error('[api]', error);
  return NextResponse.json(
    { ok: false, error: 'internal_error', message: 'Что-то пошло квадратно. Попробуй ещё раз через минуту' },
    { status: 500 },
  );
}

/** Оборачивает обработчик роута: ошибки превращаются в аккуратный JSON. */
export function handler<Args extends unknown[]>(
  fn: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      return jsonError(error);
    }
  };
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip');
}
