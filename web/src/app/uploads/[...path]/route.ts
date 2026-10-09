import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import { uploadAbsolutePath } from '@/lib/uploads';

/**
 * Отдача вложений. В проде этим занимается nginx (см. docs/nginx/krugmc.conf),
 * этот роут нужен для разработки и как запасной путь.
 * Range поддерживается, иначе видео нельзя перематывать.
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const relative = parts.join('/');

  let absolute: string;
  try {
    absolute = uploadAbsolutePath(relative);
  } catch {
    return new Response('Bad path', { status: 400 });
  }

  let stat: Awaited<ReturnType<typeof fsp.stat>>;
  try {
    stat = await fsp.stat(absolute);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!stat.isFile()) return new Response('Not found', { status: 404 });

  const extension = relative.split('.').pop()?.toLowerCase() ?? '';
  const contentType = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=2592000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  };

  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (Number.isFinite(start) && start <= end && end < stat.size) {
        const stream = fs.createReadStream(absolute, { start, end });
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          status: 206,
          headers: {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': String(end - start + 1),
          },
        });
      }
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${stat.size}` },
      });
    }
  }

  const stream = fs.createReadStream(absolute);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: { ...headers, 'Content-Length': String(stat.size) },
  });
}
