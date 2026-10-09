/**
 * Генератор пиксельных ассетов сайта.
 *
 * Всё рисуется здесь же, из кода: текстуры Mojang не используются и не
 * скачиваются. Запуск:  node scripts/generate-assets.mjs
 *
 * Что получается:
 *   public/textures/*.png: блоки 16x16 в палитре сайта
 *   public/cards/_*.png: заглушка и примеры карточек игроков
 *   public/og.png: картинка для Open Graph
 *   public/logo.svg и иконки: символ логотипа без фона
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const texturesDir = path.join(root, 'public', 'textures');
const cardsDir = path.join(root, 'public', 'cards');

// --- маленький детерминированный генератор шума ------------------------------
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (value) => {
  const clean = value.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Блок 16x16: основной тон с зерном, светлая грань сверху-слева,
 * тёмная снизу-справа, сверху: вкрапления (руда, трава, мох).
 */
function makeBlock({
  seed,
  base,
  grain = 14,
  top = null,
  topRows = 0,
  speckles = null,
  speckleCount = 0,
  edge = 26,
}) {
  const random = mulberry32(seed);
  const size = 16;
  const data = Buffer.alloc(size * size * 4);
  const baseRgb = hex(base);
  const topRgb = top ? hex(top) : null;
  const speckleRgb = speckles ? hex(speckles) : null;

  const speckleSet = new Set();
  for (let i = 0; i < speckleCount; i += 1) {
    speckleSet.add(`${Math.floor(random() * size)}:${Math.floor(random() * size)}`);
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const isTop = topRgb && y < topRows;
      let [r, g, b] = isTop ? topRgb : baseRgb;

      const jitter = (random() - 0.5) * grain * 2;
      r += jitter;
      g += jitter;
      b += jitter;

      if (speckleRgb && speckleSet.has(`${x}:${y}`) && !isTop) {
        [r, g, b] = speckleRgb;
        const s = (random() - 0.5) * 10;
        r += s;
        g += s;
        b += s;
      }

      // объёмная рамка: свет сверху-слева, тень снизу-справа
      if (y === 0 || x === 0) {
        r += edge;
        g += edge;
        b += edge;
      }
      if (y === size - 1 || x === size - 1) {
        r -= edge;
        g -= edge;
        b -= edge;
      }

      const offset = (y * size + x) * 4;
      data[offset] = clamp(r);
      data[offset + 1] = clamp(g);
      data[offset + 2] = clamp(b);
      data[offset + 3] = 255;
    }
  }

  return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png();
}

const BLOCKS = {
  // основная кнопка: трава сверху, земля снизу
  grass: { seed: 11, base: '#4a3526', grain: 12, top: '#3f7a32', topRows: 5, edge: 22 },
  dirt: { seed: 12, base: '#4a3526', grain: 14 },
  // вторичная кнопка
  stone: { seed: 13, base: '#4c5250', grain: 13 },
  cobble: { seed: 14, base: '#464c4a', grain: 20 },
  // фон и панели
  deepslate: { seed: 15, base: '#20262a', grain: 9 },
  obsidian: { seed: 16, base: '#161320', grain: 8, speckles: '#3b2f63', speckleCount: 10 },
  // акценты
  emerald: { seed: 17, base: '#2c6b45', grain: 10, speckles: '#8dff6a', speckleCount: 26 },
  redstone: { seed: 18, base: '#6b2222', grain: 10, speckles: '#ff4d4d', speckleCount: 24 },
  diamond: { seed: 19, base: '#2a5c60', grain: 10, speckles: '#7ff2ff', speckleCount: 22 },
  gold: { seed: 20, base: '#7a6520', grain: 10, speckles: '#ffd451', speckleCount: 26 },
  lapis: { seed: 21, base: '#233a6b', grain: 10, speckles: '#5b7ff0', speckleCount: 22 },
  moss: { seed: 22, base: '#2f5a2b', grain: 16, speckles: '#8dff6a', speckleCount: 14 },
  leaves: { seed: 23, base: '#2b4d24', grain: 22, speckles: '#69c05a', speckleCount: 30 },
  crafting: { seed: 24, base: '#6b4b2e', grain: 12, top: '#8a6a44', topRows: 4 },
  // кислотный блок для акцентов Zero Season
  glow: { seed: 25, base: '#7bd93f', grain: 12, speckles: '#dbff9c', speckleCount: 30 },
  tnt: { seed: 26, base: '#8c2b2b', grain: 10, top: '#d9d9d9', topRows: 4 },
};

// --- пиксельный шрифт для вордмарка -----------------------------------------
// Свои глифы 5x7, только то, что нужно логотипу и заглушкам.
const GLYPHS = {
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
};

function textRects(text, { x, y, scale, color }) {
  const rects = [];
  let cursor = x;
  for (const char of text) {
    const glyph = GLYPHS[char];
    if (!glyph) {
      cursor += 6 * scale;
      continue;
    }
    glyph.forEach((row, rowIndex) => {
      row.split('').forEach((pixel, columnIndex) => {
        if (pixel === '1') {
          rects.push(
            `<rect x="${cursor + columnIndex * scale}" y="${y + rowIndex * scale}" ` +
              `width="${scale}" height="${scale}" fill="${color}"/>`,
          );
        }
      });
    });
    cursor += 6 * scale;
  }
  return { svg: rects.join(''), width: cursor - x - scale };
}

/**
 * Клетки круга из квадратов: главный визуальный мотив сайта.
 * Возвращает координаты в клетках, чтобы символ можно было ровно
 * выровнять по центру любого холста.
 */
function circleCells(radiusCells) {
  const cells = [];
  const steps = Math.ceil(radiusCells) + 1;
  for (let gy = -steps; gy <= steps; gy += 1) {
    for (let gx = -steps; gx <= steps; gx += 1) {
      const distance = Math.hypot(gx, gy);
      if (distance <= radiusCells && distance > radiusCells - 1.6) {
        cells.push({ gx, gy, accent: (gx + gy) % 4 === 0 });
      }
    }
  }
  return cells;
}

/** Те же клетки, но уже прямоугольниками вокруг точки cx, cy. */
function blockCircle({ cx, cy, radius, cell, color, accent }) {
  return circleCells(radius / cell)
    .map(
      ({ gx, gy, accent: isAccent }) =>
        `<rect x="${cx + (gx - 0.5) * cell}" y="${cy + (gy - 0.5) * cell}" ` +
        `width="${cell - 1}" height="${cell - 1}" fill="${isAccent ? accent : color}"/>`,
    )
    .join('');
}

/**
 * Символ логотипа без фона: семь клеток в ширину плюс по половине клетки
 * полей, поэтому холст всегда делится на восемь и пиксели остаются ровными.
 */
function logoMarkSvg({ cell = 8, gap = 1, color = '#2f6b2c', accent = '#8dff6a' } = {}) {
  const cells = circleCells(3.25);
  const min = Math.min(...cells.map(({ gx }) => gx));
  const size = cell * 8;
  const half = cell / 2;

  const rects = cells
    .map(
      ({ gx, gy, accent: isAccent }) =>
        `<rect x="${(gx - min) * cell + half}" y="${(gy - min) * cell + half}" ` +
        `width="${cell - gap}" height="${cell - gap}" fill="${isAccent ? accent : color}"/>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects}</svg>`;
}

function cardSvg({ width, height, title, subtitle, tone }) {
  const wordmark = textRects('KRUG', { x: 0, y: 0, scale: 10, color: '#8dff6a' });
  const mark = textRects(title, { x: 0, y: 0, scale: 16, color: tone.mark });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${tone.bg}"/>
  ${Array.from({ length: Math.ceil(height / 24) }, (_, row) =>
    Array.from({ length: Math.ceil(width / 24) }, (_, column) =>
      (row + column) % 2 === 0
        ? `<rect x="${column * 24}" y="${row * 24}" width="24" height="24" fill="${tone.tile}"/>`
        : '',
    ).join(''),
  ).join('')}
  <g transform="translate(${width / 2 - 200}, ${height / 2 - 260})">
    ${blockCircle({ cx: 200, cy: 200, radius: 150, cell: 20, color: tone.circle, accent: tone.accent })}
  </g>
  <g transform="translate(${(width - mark.width) / 2}, ${height / 2 - 60})">${mark.svg}</g>
  <g transform="translate(${(width - wordmark.width) / 2}, ${height - 150})">${wordmark.svg}</g>
  <rect x="0" y="0" width="${width}" height="8" fill="${tone.accent}"/>
  <rect x="0" y="${height - 8}" width="${width}" height="8" fill="${tone.edge}"/>
  <text x="${width / 2}" y="${height - 80}" text-anchor="middle" fill="${tone.subtitle}"
        font-family="monospace" font-size="26">${subtitle}</text>
</svg>`;
}

async function main() {
  await fs.mkdir(texturesDir, { recursive: true });
  await fs.mkdir(cardsDir, { recursive: true });

  for (const [name, options] of Object.entries(BLOCKS)) {
    await makeBlock(options).toFile(path.join(texturesDir, `${name}.png`));
  }
  console.log(`• текстуры: ${Object.keys(BLOCKS).length} шт -> public/textures`);

  const placeholder = cardSvg({
    width: 800,
    height: 1200,
    title: '?',
    subtitle: 'card not set',
    tone: {
      bg: '#11150f',
      tile: '#141a12',
      circle: '#26331f',
      accent: '#8dff6a',
      edge: '#0a0d08',
      mark: '#3f5c33',
      subtitle: '#4d6b41',
    },
  });
  await sharp(Buffer.from(placeholder)).png().toFile(path.join(cardsDir, '_placeholder.png'));

  const exampleOne = cardSvg({
    width: 800,
    height: 1200,
    title: 'K',
    subtitle: '800 x 1200 · 2:3',
    tone: {
      bg: '#0f1410',
      tile: '#131a13',
      circle: '#1f4a24',
      accent: '#8dff6a',
      edge: '#0a0d08',
      mark: '#8dff6a',
      subtitle: '#6f9c5c',
    },
  });
  await sharp(Buffer.from(exampleOne)).png().toFile(path.join(cardsDir, '_example-1.png'));

  const exampleTwo = cardSvg({
    width: 800,
    height: 1200,
    title: 'Z',
    subtitle: 'zero season',
    tone: {
      bg: '#0d100f',
      tile: '#121614',
      circle: '#2a3a2a',
      accent: '#c6ff4f',
      edge: '#080a09',
      mark: '#c6ff4f',
      subtitle: '#7c8f63',
    },
  });
  await sharp(Buffer.from(exampleTwo)).png().toFile(path.join(cardsDir, '_example-2.png'));
  console.log('• карточки-заглушки -> public/cards');

  // Open Graph 1200x630
  const wordmark = textRects('KRUG', { x: 0, y: 0, scale: 22, color: '#8dff6a' });
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0e120f"/>
  ${Array.from({ length: 27 }, (_, row) =>
    Array.from({ length: 50 }, (_, column) =>
      (row + column) % 2 === 0
        ? `<rect x="${column * 24}" y="${row * 24}" width="24" height="24" fill="#111610"/>`
        : '',
    ).join(''),
  ).join('')}
  <g transform="translate(830, 100)">
    ${blockCircle({ cx: 170, cy: 215, radius: 170, cell: 22, color: '#274d25', accent: '#8dff6a' })}
  </g>
  <g transform="translate(90, 210)">${wordmark.svg}</g>
  <text x="92" y="400" fill="#9bbd86" font-family="monospace" font-size="34">krugmc.ru</text>
  <rect x="0" y="0" width="1200" height="10" fill="#8dff6a"/>
</svg>`;
  await sharp(Buffer.from(og)).png().toFile(path.join(root, 'public', 'og.png'));

  // Символ логотипа: SVG для сайта и набор PNG для вкладок и телефонов
  await fs.writeFile(path.join(root, 'public', 'logo.svg'), logoMarkSvg(), 'utf8');

  const icons = [
    ['icon.png', 8, 1],
    ['favicon.png', 4, 1],
    ['favicon-16.png', 2, 0],
    ['apple-touch-icon.png', 22, 2],
  ];
  for (const [name, cell, gap] of icons) {
    const png = sharp(Buffer.from(logoMarkSvg({ cell, gap }))).png();
    const target = name === 'apple-touch-icon.png' ? png.extend({ top: 2, bottom: 2, left: 2, right: 2, background: transparent }) : png;
    await target.toFile(path.join(root, 'public', name));
  }
  console.log('• og.png, logo.svg и иконки -> public');
}

main().catch((error) => {
  console.error('Не удалось сгенерировать ассеты:', error);
  process.exit(1);
});
