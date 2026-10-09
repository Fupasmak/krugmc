import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'prisma/migrations/**'],
  },
  {
    rules: {
      // На сайте много пиксельной графики и внешних превью: next/image здесь
      // только мешает (он сглаживает и проксирует то, что не нужно).
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/points/**', 'src/app/admin/points/**', 'src/app/api/admin/points/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/points', '@/server/points/*', '**/server/points', '**/server/points/*'],
              message: 'Баллы видит только администрация: импорт разрешён в src/app/admin/points и src/app/api/admin/points.',
            },
          ],
        },
      ],
    },
  },
];
