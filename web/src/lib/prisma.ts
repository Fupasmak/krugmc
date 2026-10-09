import 'server-only';
import { PrismaClient } from '@prisma/client';

/**
 * В разработке Next пересоздаёт модули на каждый hot-reload, поэтому клиент
 * держим на globalThis: иначе кончатся соединения с базой.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
