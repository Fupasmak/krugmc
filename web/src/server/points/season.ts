import 'server-only';
import { Prisma, type PointCategory, type PointWeek, type Season, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { forbidden } from '@/lib/http';

const DAY = 24 * 60 * 60 * 1000;
const MSK_OFFSET = 3 * 60 * 60 * 1000;

export const FIRST_SEASON_TITLE = 'Zero Season';

export function assertAdmin(actor: User | null): asserts actor is User {
  if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'SUPERADMIN')) {
    throw forbidden('Сюда пускают только администрацию');
  }
}

export function assertSuperadmin(actor: User | null): asserts actor is User {
  if (!actor || actor.role !== 'SUPERADMIN') {
    throw forbidden('Это может только главный администратор');
  }
}

/** Понедельник 00:00 по Москве для недели, в которую попадает момент. */
export function weekStartFor(moment: Date): Date {
  const msk = new Date(moment.getTime() + MSK_OFFSET);
  const sinceMonday = (msk.getUTCDay() + 6) % 7;
  const monday = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate()) - sinceMonday * DAY;
  return new Date(monday - MSK_OFFSET);
}

export function nextWeekBoundary(moment: Date): Date {
  return new Date(weekStartFor(moment).getTime() + 7 * DAY);
}

type Presets = { category: PointCategory; title: string; amount: number | null; description?: string; oncePerSeason?: boolean }[];

const DEFAULT_PRESETS: Presets = [
  { category: 'EVENT', amount: 500, title: 'Небольшая движуха', description: 'Собрал людей, маленькая ситуация, неожиданный поступок' },
  { category: 'EVENT', amount: 1000, title: 'Заметное событие', description: 'Вовлекло нескольких игроков, имело последствия, о нём говорят' },
  { category: 'EVENT', amount: 1500, title: 'Серьёзный завоз', description: 'Большая группа, конфликт или союз, несколько этапов' },
  { category: 'EVENT', amount: 2000, title: 'Очень сильная история', description: 'Много игроков, серьёзные последствия, влияет на сервер дальше' },
  { category: 'EVENT', amount: 2500, title: 'Событие недели', description: 'Одна из главных историй недели. Можно поднять до 30' },
  { category: 'EVENT', amount: 3500, title: 'Событие, определившее кусок сезона' },
  { category: 'EVENT', amount: 10000, title: 'Исторический завоз', description: 'Один раз за сезон на весь сервер', oncePerSeason: true },
  { category: 'SOCIAL', amount: 500, title: 'Базовое взаимодействие', description: 'Общается, создаёт ситуации, знакомит людей' },
  { category: 'SOCIAL', amount: 1000, title: 'Организация или чужая история', description: 'Создал организацию, активно участвовал в чужой истории, решил конфликт' },
  { category: 'SOCIAL', amount: 1500, title: 'Большая политика', description: 'Выборы или их саботаж, начал или закончил войну, развил город, создал экосистему' },
  { category: 'COMMUNITY', amount: 500, title: 'Минимальное участие', description: 'Общение в Discord, поддержка атмосферы' },
  { category: 'COMMUNITY', amount: 1000, title: 'Активный участник', description: 'Диалоги, голосовые чаты, активности' },
  { category: 'COMMUNITY', amount: 1500, title: 'Творец', description: 'Художник, энтузиаст, автор творчества по серверу, генератор идей' },
  { category: 'COMMUNITY', amount: 5000, title: 'Сердце сообщества', description: 'На протяжении долгого времени' },
  { category: 'CONTENT', amount: 500, title: 'Стрим от часа', description: 'Стрим, который что-то дал KRUG. Обычная стройка фермы не считается' },
  { category: 'CONTENT', amount: 3000, title: 'Стрим, изменивший историю сервера' },
  { category: 'CONTENT', amount: 50, title: 'Шортс или тикток за факт', description: 'Показывает KRUG, не спам' },
  { category: 'CONTENT', amount: 500, title: 'Шортс или тикток: 1к просмотров' },
  { category: 'CONTENT', amount: 500, title: 'YouTube-ролик: сам факт' },
  { category: 'CONTENT', amount: 1000, title: 'YouTube-ролик: хороший' },
  { category: 'CONTENT', amount: 1500, title: 'YouTube-ролик: качественный с монтажом' },
  { category: 'CONTENT', amount: 5000, title: 'YouTube-ролик: шедевр' },
  { category: 'VIEWS', amount: 500, title: 'Шортс: 10к просмотров' },
  { category: 'VIEWS', amount: 500, title: 'Тикток или рилс: 5к просмотров' },
  { category: 'VIEWS', amount: 3000, title: 'Шортс: 100к просмотров' },
  { category: 'VIEWS', amount: 5000, title: 'Тикток или рилс: 100к просмотров' },
  { category: 'VIEWS', amount: 500, title: 'YouTube-ролик: 2к просмотров' },
  { category: 'VIEWS', amount: 1500, title: 'YouTube-ролик: 10к просмотров' },
  { category: 'VIEWS', amount: 5000, title: 'YouTube-ролик: 100к просмотров' },
  { category: 'VIEWS', amount: null, title: '1 млн+ просмотров', description: 'Сумма по решению, кратная 5' },
  { category: 'REFERRAL', amount: 2000, title: 'Приглашённого приняли в состав', description: 'Разово, до открытия сервера. Выдаётся пригласившему' },
];

async function ensurePresets() {
  const count = await prisma.pointPreset.count();
  if (count > 0) return;
  await prisma.pointPreset.createMany({
    data: DEFAULT_PRESETS.map((preset, index) => ({
      category: preset.category,
      title: preset.title,
      description: preset.description ?? null,
      amount: preset.amount,
      oncePerSeason: preset.oncePerSeason ?? false,
      order: index,
    })),
  });
}

/** Текущий сезон: последний по номеру. Первый заводится сам. */
export async function currentSeason(): Promise<Season> {
  await ensurePresets();
  const latest = await prisma.season.findFirst({ orderBy: { number: 'desc' } });
  if (latest) return latest;

  try {
    return await prisma.season.create({
      data: { number: 0, title: FIRST_SEASON_TITLE, startsAt: weekStartFor(new Date()) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.season.findFirstOrThrow({ orderBy: { number: 'desc' } });
    }
    throw error;
  }
}

async function createWeek(seasonId: string, number: number, startsAt: Date): Promise<PointWeek> {
  try {
    return await prisma.pointWeek.create({
      data: { seasonId, number, startsAt, endsAt: nextWeekBoundary(startsAt) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.pointWeek.findUniqueOrThrow({ where: { seasonId_number: { seasonId, number } } });
    }
    throw error;
  }
}

/**
 * Текущая неделя сезона. Истёкшие недели закрываются сами, после ручного
 * закрытия следующая начинается сразу и тянется до ближайшего понедельника.
 */
export async function currentWeek(season: Season, now = new Date()): Promise<PointWeek> {
  let week = await prisma.pointWeek.findFirst({
    where: { seasonId: season.id },
    orderBy: { number: 'desc' },
  });

  if (!week) week = await createWeek(season.id, 1, season.startsAt);
  if (season.closedAt) return week;

  while (week.closedAt || week.endsAt <= now) {
    if (!week.closedAt) {
      await prisma.pointWeek.updateMany({
        where: { id: week.id, closedAt: null },
        data: { closedAt: week.endsAt },
      });
    }
    week = await createWeek(season.id, week.number + 1, week.endsAt);
  }

  return week;
}

export async function seasonWeeks(seasonId: string) {
  return prisma.pointWeek.findMany({ where: { seasonId }, orderBy: { number: 'desc' } });
}

export async function ensureSeasonPlayer(seasonId: string, userId: string) {
  return prisma.seasonPlayer.upsert({
    where: { seasonId_userId: { seasonId, userId } },
    create: { seasonId, userId },
    update: {},
  });
}
