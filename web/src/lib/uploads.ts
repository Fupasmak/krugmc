import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import Busboy from 'busboy';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { env } from './env';
import { badRequest } from './http';

export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export type UploadedFile = {
  kind: 'IMAGE' | 'VIDEO';
  /** Путь относительно UPLOAD_DIR, он же кусок публичного адреса /uploads/... */
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
};

export type ParsedUpload = {
  fields: Record<string, string>;
  files: UploadedFile[];
};

function uploadRoot() {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}

export function uploadAbsolutePath(relative: string) {
  const root = uploadRoot();
  const full = path.resolve(root, relative);
  // Защита от выхода за пределы папки загрузок через ../
  if (!full.startsWith(root + path.sep)) throw badRequest('bad_path', 'Неверный путь файла');
  return full;
}

async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Принимает multipart/form-data потоком: файл на 200 МБ не должен целиком
 * оказаться в памяти. Тип файла проверяется по сигнатуре, а не по заголовку
 * от клиента: заголовку верить нельзя.
 */
export async function parseUpload(
  request: Request,
  options: { maxFiles: number; allowVideo: boolean },
): Promise<ParsedUpload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    throw badRequest('bad_content_type', 'Ожидается multipart/form-data');
  }
  if (!request.body) throw badRequest('empty_body', 'Пустой запрос');

  const maxImageBytes = env.MAX_IMAGE_MB * 1024 * 1024;
  const maxVideoBytes = env.MAX_VIDEO_MB * 1024 * 1024;
  const limitBytes = options.allowVideo ? Math.max(maxImageBytes, maxVideoBytes) : maxImageBytes;

  const now = new Date();
  const subdir = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  const targetDir = path.join(uploadRoot(), subdir);
  await ensureDir(targetDir);

  const fields: Record<string, string> = {};
  const tempPaths: { temp: string; original: string }[] = [];
  let fileCount = 0;

  const busboy = Busboy({
    headers: { 'content-type': contentType },
    limits: { files: options.maxFiles, fileSize: limitBytes, fields: 20, fieldSize: 100_000 },
  });

  const finished = new Promise<void>((resolve, reject) => {
    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (_name, stream, info) => {
      fileCount += 1;
      if (fileCount > options.maxFiles) {
        stream.resume();
        return;
      }
      const temp = path.join(targetDir, `${crypto.randomBytes(16).toString('hex')}.part`);
      tempPaths.push({ temp, original: info.filename });

      const write = fs.createWriteStream(temp);
      stream.on('limit', () => {
        write.destroy();
        reject(
          badRequest(
            'file_too_large',
            `Файл больше лимита: картинки до ${env.MAX_IMAGE_MB} МБ, видео до ${env.MAX_VIDEO_MB} МБ`,
          ),
        );
      });
      stream.pipe(write);
    });

    busboy.on('filesLimit', () => {
      reject(badRequest('too_many_files', `Можно приложить не больше ${options.maxFiles} файлов`));
    });
    busboy.on('error', reject);
    busboy.on('close', () => resolve());
  });

  try {
    await pipeline(Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]), busboy);
    await finished;
  } catch (error) {
    await Promise.all(tempPaths.map(({ temp }) => fsp.rm(temp, { force: true })));
    throw error;
  }

  const files: UploadedFile[] = [];
  try {
    for (const { temp } of tempPaths) {
      const stat = await fsp.stat(temp);
      // Тип определяем по сигнатуре первых байт, а не по заголовку от клиента.
      const probe = Buffer.alloc(4100);
      const fh = await fsp.open(temp, 'r');
      const { bytesRead } = await fh.read(probe, 0, probe.length, 0);
      await fh.close();
      const detected = await fileTypeFromBuffer(probe.subarray(0, bytesRead));
      const mime = detected?.mime ?? '';

      const isImage = (IMAGE_MIMES as readonly string[]).includes(mime);
      const isVideo = (VIDEO_MIMES as readonly string[]).includes(mime);

      if (!isImage && !(options.allowVideo && isVideo)) {
        throw badRequest(
          'bad_file_type',
          'Фу! Такое не грузим. Подходят картинки png, jpg, webp, gif' +
            (options.allowVideo ? ' и видео mp4, webm, mov' : ''),
        );
      }
      if (isImage && stat.size > maxImageBytes) {
        throw badRequest('file_too_large', `Картинка тяжелее ${env.MAX_IMAGE_MB} МБ, ужми её`);
      }
      if (isVideo && stat.size > maxVideoBytes) {
        throw badRequest('file_too_large', `Видео тяжелее ${env.MAX_VIDEO_MB} МБ, ужми или залей на YouTube`);
      }

      let width: number | null = null;
      let height: number | null = null;
      if (isImage) {
        const meta = await sharp(temp).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      }

      const extension = EXTENSION_BY_MIME[mime] ?? 'bin';
      const finalName = `${path.basename(temp, '.part')}.${extension}`;
      await fsp.rename(temp, path.join(targetDir, finalName));

      files.push({
        kind: isImage ? 'IMAGE' : 'VIDEO',
        path: path.posix.join(subdir.split(path.sep).join('/'), finalName),
        mime,
        size: stat.size,
        width,
        height,
      });
    }
  } catch (error) {
    await Promise.all(tempPaths.map(({ temp }) => fsp.rm(temp, { force: true })));
    await Promise.all(files.map((file) => fsp.rm(uploadAbsolutePath(file.path), { force: true })));
    throw error;
  }

  return { fields, files };
}

export async function deleteUpload(relative: string) {
  try {
    await fsp.rm(uploadAbsolutePath(relative), { force: true });
  } catch {
    // файла может и не быть это не повод падать
  }
}

/** Карточка игрока: приводим к PNG и кладём в public/cards/<ник>.png */
export async function saveCardPng(nicknameLower: string, source: Buffer): Promise<string> {
  const dir = path.resolve(process.cwd(), 'public', 'cards');
  await ensureDir(dir);
  const fileName = `${nicknameLower}.png`;
  await sharp(source)
    .resize(800, 1200, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, fileName));
  return fileName;
}
