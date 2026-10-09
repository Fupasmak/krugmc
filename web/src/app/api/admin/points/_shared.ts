import type { PointCategory } from '@prisma/client';
import { jsonOk } from '@/lib/http';
import { POINT_CATEGORIES } from '@/lib/points';

export const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

export function privateJson<T>(data: T) {
  return jsonOk(data, { headers: PRIVATE_HEADERS });
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export function journalFilters(url: URL) {
  const category = url.searchParams.get('category');
  return {
    actorId: url.searchParams.get('admin'),
    userId: url.searchParams.get('player'),
    weekId: url.searchParams.get('week'),
    category: POINT_CATEGORIES.includes(category as PointCategory) ? (category as PointCategory) : null,
  };
}
