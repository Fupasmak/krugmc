import fsp from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler } from '@/lib/http';
import { verifySignedRequest } from '@/lib/hmac';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { uploadAbsolutePath } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const schema = z.object({
  tgId: z.string().regex(/^\d{1,20}$/),
  mime: z.string().max(64),
  data: z.string().max(1_400_000), // base64 от 512 КБ с запасом
});

/**
 * Бот приносит аватар зрителя байтами.
 * Прямые ссылки Telegram содержат токен бота, поэтому их не храним:
 * картинка кладётся в uploads/avatars и раздаётся с нашего домена.
 */
export const POST = handler(async (request) => {
  const verified = await verifySignedRequest(request, env.INTERNAL_API_SECRET, 'bot');
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: verified.status });
  }

  const data = schema.parse(JSON.parse(verified.body));
  const tgId = BigInt(data.tgId);

  const user = await prisma.user.findUnique({ where: { tgId } });
  if (!user) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });

  const raw = Buffer.from(data.data, 'base64');
  if (raw.byteLength === 0 || raw.byteLength > 512 * 1024) {
    return NextResponse.json({ ok: false, error: 'bad_size' }, { status: 400 });
  }

  const relative = path.posix.join('avatars', `${data.tgId}.png`);
  const absolute = uploadAbsolutePath(relative);
  await fsp.mkdir(path.dirname(absolute), { recursive: true });

  await sharp(raw).resize(128, 128, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(absolute);

  await prisma.user.update({
    where: { id: user.id },
    data: { tgPhotoUrl: `/uploads/${relative}?v=${Date.now()}` },
  });

  return NextResponse.json({ ok: true });
});
