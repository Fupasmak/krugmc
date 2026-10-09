import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

// Единый .env лежит в корне монорепо — его же читают бот и docker-compose.
loadEnv({ path: path.resolve(process.cwd(), '../.env') });

const nextConfig: NextConfig = {
  output: 'standalone',
  // Монорепо: трассировка файлов должна начинаться с корня, иначе в
  // standalone-сборку не попадут зависимости из общего node_modules.
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  reactStrictMode: true,
  // Значок разработки в углу мешает смотреть макет
  devIndicators: false,
  poweredByHeader: false,
  // Вложения раздаёт nginx в проде; в разработке их отдаёт роут /uploads/[...path].
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
