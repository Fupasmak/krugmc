import { handler, jsonOk } from '@/lib/http';
import { readBrowserToken } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const browserToken = await readBrowserToken();
  if (!browserToken) return jsonOk({ state: 'none' });

  const code = await prisma.loginCode.findFirst({ where: { browserToken }, orderBy: { createdAt: 'desc' } });
  if (!code) return jsonOk({ state: 'none' });
  if (code.status === 'CONFIRMED') return jsonOk({ state: 'confirmed' });
  if (code.status === 'PENDING' && code.expiresAt > new Date()) {
    return jsonOk({ state: 'pending', expiresAt: code.expiresAt.toISOString() });
  }
  if (code.status === 'PENDING') {
    await prisma.loginCode.update({ where: { id: code.id }, data: { status: 'EXPIRED' } });
  }
  return jsonOk({ state: 'expired' });
});