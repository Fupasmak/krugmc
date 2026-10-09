/**
 * Проверка на длинные тире в текстах, которые видит пользователь.
 *
 * Ищет «—» (U+2014) и «–» (U+2013). Знак минуса «−» (U+2212) на кнопке
 * голосования разрешён и не проверяется.
 *
 * Запуск: npm run check:dashes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Где смотрим: интерфейс, тексты страниц, сообщения бота и плагина
const ROOTS = [
  'web/src',
  'web/content',
  'web/public/cards',
  'web/prisma',
  'web/scripts',
  'TGBOT/src',
  'minecraft/src/main/resources',
];

const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.md', '.mjs', '.yml', '.yaml', '.json']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'migrations']);
const DASHES = /[—–]/g;

function walk(dir, found) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, found);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;

    const text = fs.readFileSync(full, 'utf8');
    if (!DASHES.test(text)) continue;
    DASHES.lastIndex = 0;

    text.split('\n').forEach((line, index) => {
      if (/[—–]/.test(line)) {
        found.push({
          file: path.relative(root, full).split(path.sep).join('/'),
          line: index + 1,
          text: line.trim(),
        });
      }
    });
  }
}

const found = [];
for (const dir of ROOTS) walk(path.join(root, dir), found);

if (found.length === 0) {
  console.log('Длинных тире нет, 0 совпадений.');
  process.exit(0);
}

console.error(`Найдены длинные тире: ${found.length}\n`);
for (const hit of found) {
  console.error(`${hit.file}:${hit.line}`);
  console.error(`  ${hit.text}`);
}
console.error('\nПерепиши фразу: двоеточие, запятая, точка или обычный дефис.');
process.exit(1);
