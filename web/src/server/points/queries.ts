import 'server-only';
import type { PointCategory, Prisma, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound } from '@/lib/http';
import { CATEGORY_LABELS, KIND_LABELS, formatPoints, maxWithdraw } from '@/lib/points';
import { assertAdmin, assertSuperadmin, currentSeason, currentWeek, seasonWeeks } from './season';
import { isValidPresetAmount } from '@/lib/points';

const entryInclude = {
  actor: { select: { mcNickname: true } },
  preset: { select: { title: true } },
  post: { select: { id: true, title: true } },
  week: { select: { number: true } },
  player: { select: { user: { select: { id: true, mcNickname: true } } } },
  revertedBy: { select: { id: true } },
  source: { select: { player: { select: { user: { select: { mcNickname: true } } } } } },
} satisfies Prisma.PointEntryInclude;

type EntryRow = Prisma.PointEntryGetPayload<{ include: typeof entryInclude }>;

export type PointEntryView = {
  id: string;
  createdAt: string;
  kind: string;
  bucket: 'MAIN' | 'RESERVE';
  category: PointCategory | null;
  amount: number;
  comment: string;
  proofUrl: string | null;
  post: { id: string; title: string } | null;
  presetTitle: string | null;
  actor: string;
  playerId: string;
  player: string;
  weekNumber: number;
  reverted: boolean;
  revertable: boolean;
  from: string | null;
};

function toView(row: EntryRow): PointEntryView {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    kind: row.kind,
    bucket: row.bucket,
    category: row.category,
    amount: row.amount,
    comment: row.comment,
    proofUrl: row.proofUrl,
    post: row.post,
    presetTitle: row.preset?.title ?? null,
    actor: row.actor.mcNickname ?? '-',
    playerId: row.player.user.id,
    player: row.player.user.mcNickname ?? '-',
    weekNumber: row.week.number,
    reverted: Boolean(row.revertedBy),
    revertable: (row.kind === 'AWARD' || row.kind === 'ADJUSTMENT') && !row.revertedBy,
    from: row.source?.player.user.mcNickname ?? null,
  };
}

export type PointsPlayerRow = {
  userId: string;
  nickname: string;
  isTest: boolean;
  week: number;
  season: number;
  reserve: number;
  lastAt: string | null;
};

async function resolveWeek(seasonId: string, weekId: string | null | undefined) {
  if (!weekId) return null;
  const week = await prisma.pointWeek.findFirst({ where: { id: weekId, seasonId } });
  if (!week) throw badRequest('bad_week', 'Такой недели в сезоне нет');
  return week;
}

export async function pointsOverview(actor: User | null, params: { weekId?: string | null }) {
  assertAdmin(actor);
  const season = await currentSeason();
  const current = await currentWeek(season);
  const week = (await resolveWeek(season.id, params.weekId)) ?? current;
  const weeks = await seasonWeeks(season.id);

  const [users, seasonSums, weekSums, lastAwards] = await Promise.all([
    prisma.user.findMany({
      where: { type: 'MC' },
      select: {
        id: true,
        mcNickname: true,
        isTest: true,
        seasonEntries: { where: { seasonId: season.id }, select: { id: true } },
      },
      orderBy: { mcNicknameLower: 'asc' },
    }),
    prisma.pointEntry.groupBy({
      by: ['playerId', 'bucket'],
      where: { seasonId: season.id },
      _sum: { amount: true },
    }),
    prisma.pointEntry.groupBy({
      by: ['playerId'],
      where: { weekId: week.id, bucket: 'MAIN' },
      _sum: { amount: true },
    }),
    prisma.pointEntry.groupBy({
      by: ['playerId'],
      where: { seasonId: season.id, kind: { in: ['AWARD', 'ADJUSTMENT'] } },
      _max: { createdAt: true },
    }),
  ]);

  const main = new Map<string, number>();
  const reserve = new Map<string, number>();
  for (const row of seasonSums) {
    (row.bucket === 'MAIN' ? main : reserve).set(row.playerId, row._sum.amount ?? 0);
  }
  const weekly = new Map(weekSums.map((row) => [row.playerId, row._sum.amount ?? 0]));
  const last = new Map(lastAwards.map((row) => [row.playerId, row._max.createdAt]));

  const rows: PointsPlayerRow[] = users.map((user) => {
    const playerId = user.seasonEntries[0]?.id;
    return {
      userId: user.id,
      nickname: user.mcNickname ?? '-',
      isTest: user.isTest,
      week: playerId ? (weekly.get(playerId) ?? 0) : 0,
      season: playerId ? (main.get(playerId) ?? 0) : 0,
      reserve: playerId ? (reserve.get(playerId) ?? 0) : 0,
      lastAt: playerId ? (last.get(playerId)?.toISOString() ?? null) : null,
    };
  });

  return {
    season: {
      id: season.id,
      title: season.title,
      number: season.number,
      closed: Boolean(season.closedAt),
    },
    currentWeekId: current.id,
    week: { id: week.id, number: week.number, startsAt: week.startsAt.toISOString(), endsAt: week.endsAt.toISOString(), closed: Boolean(week.closedAt) },
    weeks: weeks.map((item) => ({
      id: item.id,
      number: item.number,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      closed: Boolean(item.closedAt),
    })),
    rows,
  };
}

export async function playerPoints(actor: User | null, userId: string) {
  assertAdmin(actor);
  const season = await currentSeason();
  const user = await prisma.user.findFirst({
    where: { id: userId, type: 'MC' },
    select: { id: true, mcNickname: true, isTest: true },
  });
  if (!user) throw notFound('Игрок не найден');

  const player = await prisma.seasonPlayer.findUnique({
    where: { seasonId_userId: { seasonId: season.id, userId } },
    include: {
      invitedBy: { select: { user: { select: { id: true, mcNickname: true } } } },
      invited: { select: { user: { select: { id: true, mcNickname: true } } } },
    },
  });

  const entries = player
    ? await prisma.pointEntry.findMany({
        where: { playerId: player.id },
        include: entryInclude,
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const totals = { main: 0, reserve: 0 };
  for (const entry of entries) {
    if (entry.bucket === 'MAIN') totals.main += entry.amount;
    else totals.reserve += entry.amount;
  }

  const candidates = await prisma.user.findMany({
    where: { type: 'MC', id: { not: userId } },
    select: {
      id: true,
      mcNickname: true,
      seasonEntries: { where: { seasonId: season.id }, select: { invitedById: true } },
    },
    orderBy: { mcNicknameLower: 'asc' },
  });

  return {
    season: { id: season.id, title: season.title, closed: Boolean(season.closedAt) },
    player: { userId: user.id, nickname: user.mcNickname ?? '-', isTest: user.isTest },
    totals: { ...totals, maxWithdraw: maxWithdraw(totals.reserve) },
    invitedBy: player?.invitedBy
      ? { userId: player.invitedBy.user.id, nickname: player.invitedBy.user.mcNickname ?? '-' }
      : null,
    invited: (player?.invited ?? []).map((row) => ({
      userId: row.user.id,
      nickname: row.user.mcNickname ?? '-',
    })),
    inviterOptions: candidates
      .filter((candidate) => !candidate.seasonEntries[0]?.invitedById)
      .map((candidate) => ({ userId: candidate.id, nickname: candidate.mcNickname ?? '-' })),
    entries: entries.map(toView),
  };
}

export type JournalFilters = {
  actorId?: string | null;
  userId?: string | null;
  category?: PointCategory | null;
  weekId?: string | null;
  limit?: number;
};

export async function journal(actor: User | null, filters: JournalFilters) {
  assertAdmin(actor);
  const season = await currentSeason();
  const where: Prisma.PointEntryWhereInput = { seasonId: season.id };
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.userId) where.player = { userId: filters.userId };
  if (filters.category) where.category = filters.category;
  if (filters.weekId) where.weekId = filters.weekId;

  const rows = await prisma.pointEntry.findMany({
    where,
    include: entryInclude,
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.limit ?? 300, 5000),
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
    select: { id: true, mcNickname: true },
    orderBy: { mcNicknameLower: 'asc' },
  });

  return {
    season: { id: season.id, title: season.title },
    entries: rows.map(toView),
    admins: admins.map((admin) => ({ id: admin.id, nickname: admin.mcNickname ?? '-' })),
  };
}

export async function weekSummary(actor: User | null, weekId?: string | null) {
  assertAdmin(actor);
  const season = await currentSeason();
  const week = (await resolveWeek(season.id, weekId)) ?? (await currentWeek(season));

  const entries = await prisma.pointEntry.findMany({
    where: { weekId: week.id, bucket: 'MAIN' },
    include: entryInclude,
    orderBy: { createdAt: 'asc' },
  });

  const totals = new Map<string, { userId: string; nickname: string; amount: number }>();
  for (const entry of entries) {
    const key = entry.player.user.id;
    const current = totals.get(key) ?? { userId: key, nickname: entry.player.user.mcNickname ?? '-', amount: 0 };
    current.amount += entry.amount;
    totals.set(key, current);
  }

  const byCategory = new Map<string, PointEntryView[]>();
  for (const entry of entries) {
    if (entry.kind === 'REVERSAL' || entry.revertedBy) continue;
    const key = entry.category ?? 'ADJUSTMENT';
    const list = byCategory.get(key) ?? [];
    list.push(toView(entry));
    byCategory.set(key, list);
  }

  const weeks = await seasonWeeks(season.id);

  return {
    season: { title: season.title },
    week: {
      id: week.id,
      number: week.number,
      startsAt: week.startsAt.toISOString(),
      endsAt: week.endsAt.toISOString(),
      closed: Boolean(week.closedAt),
    },
    weeks: weeks.map((item) => ({ id: item.id, number: item.number })),
    top: [...totals.values()].filter((row) => row.amount !== 0).sort((a, b) => b.amount - a.amount),
    categories: [...byCategory.entries()].map(([category, list]) => ({
      category,
      label: CATEGORY_LABELS[category as PointCategory] ?? category,
      entries: list,
    })),
  };
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csv(rows: (string | number | null)[][]): string {
  return '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export async function playersCsv(actor: User | null, weekId?: string | null) {
  const overview = await pointsOverview(actor, { weekId });
  return csv([
    ['Ник', `Неделя ${overview.week.number}`, 'Сезон', 'Резерв', 'Последнее начисление'],
    ...overview.rows.map((row) => [
      row.nickname,
      formatPoints(row.week),
      formatPoints(row.season),
      formatPoints(row.reserve),
      row.lastAt,
    ]),
  ]);
}

export async function journalCsv(actor: User | null, filters: JournalFilters) {
  const data = await journal(actor, { ...filters, limit: 5000 });
  return csv([
    ['Когда', 'Неделя', 'Игрок', 'Тип', 'Счёт', 'Категория', 'Пресет', 'Баллы', 'Комментарий', 'Ссылка', 'Завоз', 'Выдал', 'Отменено'],
    ...data.entries.map((entry) => [
      entry.createdAt,
      entry.weekNumber,
      entry.player,
      KIND_LABELS[entry.kind] ?? entry.kind,
      entry.bucket === 'MAIN' ? 'основной' : 'резерв',
      entry.category ? CATEGORY_LABELS[entry.category] : '',
      entry.presetTitle,
      formatPoints(entry.amount),
      entry.comment,
      entry.proofUrl,
      entry.post?.title ?? null,
      entry.actor,
      entry.reverted ? 'да' : '',
    ]),
  ]);
}

export async function listPresets(actor: User | null) {
  assertAdmin(actor);
  await currentSeason();
  return prisma.pointPreset.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }] });
}

export type PresetInput = {
  category: PointCategory;
  title: string;
  description?: string | null;
  amount: number | null;
  oncePerSeason?: boolean;
  active?: boolean;
  order?: number;
};

function checkPreset(input: PresetInput) {
  if (input.category === 'ADJUSTMENT') {
    throw badRequest('bad_preset', 'Корректировки делаются без пресета');
  }
  if (!isValidPresetAmount(input.amount)) {
    throw badRequest('bad_amount', 'Сумма пресета кратна 5, либо 0,5, либо пусто для суммы по решению');
  }
}

export async function createPreset(actor: User | null, input: PresetInput) {
  assertSuperadmin(actor);
  checkPreset(input);
  return prisma.pointPreset.create({
    data: {
      category: input.category,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
      oncePerSeason: input.oncePerSeason ?? false,
      active: input.active ?? true,
      order: input.order ?? 0,
    },
  });
}

export async function updatePreset(actor: User | null, id: string, input: PresetInput) {
  assertSuperadmin(actor);
  checkPreset(input);
  const exists = await prisma.pointPreset.findUnique({ where: { id } });
  if (!exists) throw notFound('Пресет не найден');
  return prisma.pointPreset.update({
    where: { id },
    data: {
      category: input.category,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      amount: input.amount,
      oncePerSeason: input.oncePerSeason ?? false,
      active: input.active ?? true,
      order: input.order ?? 0,
    },
  });
}

export async function seasonState(actor: User | null) {
  assertAdmin(actor);
  const season = await currentSeason();
  const week = await currentWeek(season);
  const weeks = await seasonWeeks(season.id);
  const seasons = await prisma.season.findMany({ orderBy: { number: 'desc' } });
  return {
    season: {
      id: season.id,
      title: season.title,
      number: season.number,
      startsAt: season.startsAt.toISOString(),
      closedAt: season.closedAt?.toISOString() ?? null,
    },
    currentWeek: { id: week.id, number: week.number, startsAt: week.startsAt.toISOString(), endsAt: week.endsAt.toISOString(), closed: Boolean(week.closedAt) },
    weeks: weeks.map((item) => ({
      id: item.id,
      number: item.number,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString(),
      closedAt: item.closedAt?.toISOString() ?? null,
    })),
    seasons: seasons.map((item) => ({
      id: item.id,
      title: item.title,
      number: item.number,
      closedAt: item.closedAt?.toISOString() ?? null,
    })),
  };
}

export async function awardOptions(actor: User | null) {
  assertAdmin(actor);
  const season = await currentSeason();
  const week = await currentWeek(season);
  const [players, presets, posts, weeks] = await Promise.all([
    prisma.user.findMany({
      where: { type: 'MC' },
      select: { id: true, mcNickname: true },
      orderBy: { mcNicknameLower: 'asc' },
    }),
    prisma.pointPreset.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { order: 'asc' }] }),
    prisma.post.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, author: { select: { mcNickname: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    seasonWeeks(season.id),
  ]);
  return {
    season: { title: season.title, closed: Boolean(season.closedAt) },
    currentWeekId: week.id,
    players: players.map((player) => ({ id: player.id, nickname: player.mcNickname ?? '-' })),
    presets: presets.map((preset) => ({
      id: preset.id,
      category: preset.category,
      title: preset.title,
      description: preset.description,
      amount: preset.amount,
      oncePerSeason: preset.oncePerSeason,
    })),
    posts: posts.map((post) => ({ id: post.id, title: post.title, author: post.author.mcNickname ?? '-' })),
    weeks: weeks.map((item) => ({ id: item.id, number: item.number, closed: Boolean(item.closedAt) })),
  };
}
