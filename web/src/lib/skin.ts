import 'server-only';
import sharp from 'sharp';
import { prisma } from './prisma';

/**
 * Голова игрока: лицо 8x8 из скина плюс второй слой (шляпа).
 * Готовая голова 64x64 лежит в базе, наружу отдаётся масштабированной.
 *
 * Сервер лицензионный, поэтому скин берём двумя путями:
 *  1. значение textures, которое прислал плагин при входе (основной путь);
 *  2. профиль Mojang по UUID (запасной, если плагин textures не отдал).
 */

const MOJANG_PROFILE = 'https://sessionserver.mojang.com/session/minecraft/profile/';
const ALLOWED_TEXTURE_HOSTS = new Set(['textures.minecraft.net']);
const MAX_SKIN_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 8000;

export const HEAD_SIZE = 64;
export const ALLOWED_HEAD_SIZES = [16, 32, 48, 64, 96, 128, 256];

type TexturesPayload = {
  textures?: {
    SKIN?: { url?: string; metadata?: { model?: string } };
  };
};

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export function decodeTextures(value: string): { url: string | null; slim: boolean } {
  try {
    const json = JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as TexturesPayload;
    const url = json.textures?.SKIN?.url ?? null;
    const slim = json.textures?.SKIN?.metadata?.model === 'slim';
    if (!url) return { url: null, slim };
    const parsed = new URL(url);
    // Скачиваем только с домена текстур Mojang: чужие ссылки игнорируем.
    if (parsed.protocol !== 'https:' || !ALLOWED_TEXTURE_HOSTS.has(parsed.hostname)) {
      return { url: null, slim };
    }
    return { url: parsed.toString(), slim };
  } catch {
    return { url: null, slim: false };
  }
}

export async function fetchTexturesByUuid(uuid: string): Promise<string | null> {
  const clean = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(clean)) return null;
  try {
    const response = await fetchWithTimeout(`${MOJANG_PROFILE}${clean}`);
    if (!response.ok) return null;
    const profile = (await response.json()) as {
      properties?: { name: string; value: string }[];
    };
    return profile.properties?.find((p) => p.name === 'textures')?.value ?? null;
  } catch {
    return null;
  }
}

async function downloadSkin(url: string): Promise<Buffer | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const length = Number(response.headers.get('content-length') ?? '0');
    if (length > MAX_SKIN_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.byteLength > MAX_SKIN_BYTES ? null : buffer;
  } catch {
    return null;
  }
}

/** Вырезает голову из PNG скина 64x64 или 64x32. */
export async function extractHead(skin: Buffer): Promise<Buffer | null> {
  try {
    const image = sharp(skin);
    const meta = await image.metadata();
    if (meta.format !== 'png' || meta.width !== 64 || (meta.height !== 64 && meta.height !== 32)) {
      return null;
    }

    const face = await sharp(skin).extract({ left: 8, top: 8, width: 8, height: 8 }).png().toBuffer();
    const hat = await sharp(skin).extract({ left: 40, top: 8, width: 8, height: 8 }).png().toBuffer();

    return await sharp(face)
      .composite([{ input: hat, blend: 'over' }])
      .resize(HEAD_SIZE, HEAD_SIZE, { kernel: 'nearest' })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Обновляет голову игрока. Вызывается при каждом входе через Minecraft.
 * Если скачать скин не вышло, оставляем то, что было.
 */
export async function refreshUserSkin(params: {
  userId: string;
  texturesValue?: string | null;
  uuid?: string | null;
}): Promise<boolean> {
  const { userId, uuid } = params;
  let texturesValue = params.texturesValue ?? null;

  if (!texturesValue && uuid) {
    texturesValue = await fetchTexturesByUuid(uuid);
  }
  if (!texturesValue) return false;

  const { url, slim } = decodeTextures(texturesValue);
  if (!url) return false;

  const skin = await downloadSkin(url);
  if (!skin) return false;

  const head = await extractHead(skin);
  if (!head) return false;

  await prisma.skin.upsert({
    where: { userId },
    create: { userId, texturesValue, skinUrl: url, headPng: new Uint8Array(head), isSlim: slim },
    update: { texturesValue, skinUrl: url, headPng: new Uint8Array(head), isSlim: slim },
  });
  return true;
}

/**
 * Голова по умолчанию: своя пиксельная рисовка в палитре сайта.
 * Оригинальные текстуры Mojang не используются.
 */
let defaultHeadCache: Buffer | null = null;

export async function getDefaultHead(): Promise<Buffer> {
  if (defaultHeadCache) return defaultHeadCache;

  const B = [26, 32, 27, 255]; // почти чёрный зелёный, контур
  const D = [31, 58, 36, 255]; // тёмная грань
  const M = [45, 87, 50, 255]; // основной тон
  const L = [63, 116, 66, 255]; // светлая грань
  const E = [138, 255, 90, 255]; // кислотно-зелёные глаза
  const map: number[][][] = [
    [B, B, B, B, B, B, B, B],
    [B, L, L, L, L, L, L, B],
    [B, L, M, M, M, M, L, B],
    [B, M, E, M, M, E, M, B],
    [B, M, E, M, M, E, M, B],
    [B, M, M, D, D, M, M, B],
    [B, D, M, M, M, M, D, B],
    [B, B, B, B, B, B, B, B],
  ];

  const raw = Buffer.alloc(8 * 8 * 4);
  let offset = 0;
  for (const row of map) {
    for (const pixel of row) {
      raw[offset] = pixel[0];
      raw[offset + 1] = pixel[1];
      raw[offset + 2] = pixel[2];
      raw[offset + 3] = pixel[3];
      offset += 4;
    }
  }

  defaultHeadCache = await sharp(raw, { raw: { width: 8, height: 8, channels: 4 } })
    .resize(HEAD_SIZE, HEAD_SIZE, { kernel: 'nearest' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return defaultHeadCache;
}

export async function renderHead(head: Buffer, size: number): Promise<Buffer> {
  if (size === HEAD_SIZE) return head;
  return sharp(head).resize(size, size, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toBuffer();
}
