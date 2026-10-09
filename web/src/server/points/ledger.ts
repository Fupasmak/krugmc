import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PointBucket, PointCategory, Prisma, Season, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound } from '@/lib/http';
import {
  isValidAdjustment,
  isValidAwardAmount,
  isValidWithdraw,
  formatPoints,
  reserveShare,
} from '@/lib/points';
import { audit } from '@/server/admin';
import {
  assertAdmin,
  assertSuperadmin,
  currentSeason,
  currentWeek,
  weekStartFor,
} from './season';

type Tx = Prisma.TransactionClient;

export type AwardInput = {
  userIds: string[];
  category: PointCategory;
  presetId?: string | null;
  amount: number;
  comment: string;
  proofUrl?: string | null;
  postId?: string | null;
  weekId?: string | null;
  confirmOncePerSeason?: boolean;
};

export type AwardPlan = {
  season: Season;
  weekId: string;
  weekNumber: number;
  kind: 'AWARD' | 'ADJUSTMENT';
  presetTitle: string | null;
  oncePerSeason: boolean;
  onceUsed: boolean;
  recipients: {
    userId: string;
    nickname: string;
    amount: number;
    inviter: { userId: string; nickname: string; share: number } | null;
  }[];
};

async function lockSeason(tx: Tx, seasonId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`points:${seasonId}`}))::text`;
}

async function openSeason(): Promise<Season> {
  const season = await currentSeason();
  if (season.closedAt) {
    throw badRequest('season_closed', 'Сезон закрыт. Начни новый, чтобы начислять дальше');
  }
  return season;
}

async function onceUsed(db: Tx | typeof prisma, seasonId: string, presetId: string) {
  const count = await db.pointEntry.count({
    where: { seasonId, presetId, kind: 'AWARD', revertedBy: { is: null } },
  });
  return count > 0;
}

async function sum(db: Tx | typeof prisma, playerId: string, bucket: PointBucket) {
  const result = await db.pointEntry.aggregate({ where: { playerId, bucket }, _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

export async function planAward(actor: User | null, input: AwardInput): Promise<AwardPlan> {
  assertAdmin(actor);
  const season = await openSeason();

  const userIds = [...new Set(input.userIds)];
  if (userIds.length === 0) throw badRequest('no_players', 'Выбери хотя бы одного игрока');

  const comment = input.comment.trim();
  if (comment.length < 3) throw badRequest('comment_required', 'Комментарий обязателен');

  const week = input.weekId
    ? await prisma.pointWeek.findFirst({ where: { id: input.weekId, seasonId: season.id } })
    : await currentWeek(season);
  if (!week) throw badRequest('bad_week', 'Такой недели в текущем сезоне нет');

  const preset = input.presetId
    ? await prisma.pointPreset.findUnique({ where: { id: input.presetId } })
    : null;
  if (input.presetId && (!preset || !preset.active)) {
    throw badRequest('bad_preset', 'Пресет не найден или выключен');
  }
  if (preset && preset.category !== input.category) {
    throw badRequest('bad_preset', 'Пресет из другой категории');
  }

  const kind = input.category === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'AWARD';
  if (kind === 'ADJUSTMENT') {
    if (preset) throw badRequest('bad_preset', 'У корректировки нет пресета');
    if (!isValidAdjustment(input.amount)) {
      throw badRequest('bad_amount', 'Корректировка: не ноль и шаг 0,5 балла');
    }
  } else if (!isValidAwardAmount(input.amount, preset?.amount ?? null)) {
    throw badRequest(
      'bad_amount',
      'Сумма должна быть кратна 5. Исключение одно: 0,5 за шортс по пресету',
    );
  }

  if (input.postId) {
    const post = await prisma.post.findFirst({ where: { id: input.postId, deletedAt: null } });
    if (!post) throw badRequest('bad_post', 'Завоз не найден');
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, type: 'MC' },
    select: { id: true, mcNickname: true },
  });
  if (users.length !== userIds.length) throw badRequest('bad_player', 'Кого-то из игроков нет');

  const seasonPlayers = await prisma.seasonPlayer.findMany({
    where: { seasonId: season.id, userId: { in: userIds } },
    select: { userId: true, invitedBy: { select: { user: { select: { id: true, mcNickname: true } } } } },
  });
  const inviterOf = new Map(seasonPlayers.map((row) => [row.userId, row.invitedBy?.user ?? null]));

  const oncePerSeason = preset?.oncePerSeason ?? false;
  const used = oncePerSeason && preset ? await onceUsed(prisma, season.id, preset.id) : false;

  return {
    season,
    weekId: week.id,
    weekNumber: week.number,
    kind,
    presetTitle: preset?.title ?? null,
    oncePerSeason,
    onceUsed: used,
    recipients: users.map((user) => {
      const inviter = kind === 'AWARD' ? inviterOf.get(user.id) : null;
      return {
        userId: user.id,
        nickname: user.mcNickname ?? '-',
        amount: input.amount,
        inviter: inviter
          ? { userId: inviter.id, nickname: inviter.mcNickname ?? '-', share: reserveShare(input.amount) }
          : null,
      };
    }),
  };
}

export async function award(actor: User | null, input: AwardInput) {
  const plan = await planAward(actor, input);
  assertAdmin(actor);

  if (plan.oncePerSeason) {
    if (plan.onceUsed) throw badRequest('once_used', 'Этот пресет в сезоне уже выдан');
    if (!input.confirmOncePerSeason) {
      throw badRequest('confirm_required', 'Подтверди выдачу: она бывает один раз за сезон');
    }
  }

  const batchId = randomUUID();
  const comment = input.comment.trim();

  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, plan.season.id);
    if (plan.oncePerSeason && input.presetId && (await onceUsed(tx, plan.season.id, input.presetId))) {
      throw badRequest('once_used', 'Этот пресет в сезоне уже выдан');
    }

    for (const recipient of plan.recipients) {
      const player = await tx.seasonPlayer.upsert({
        where: { seasonId_userId: { seasonId: plan.season.id, userId: recipient.userId } },
        create: { seasonId: plan.season.id, userId: recipient.userId },
        update: {},
      });

      const entry = await tx.pointEntry.create({
        data: {
          seasonId: plan.season.id,
          weekId: plan.weekId,
          playerId: player.id,
          bucket: 'MAIN',
          kind: plan.kind,
          category: input.category,
          presetId: input.presetId ?? null,
          amount: recipient.amount,
          comment,
          proofUrl: input.proofUrl?.trim() || null,
          postId: input.postId ?? null,
          batchId,
          actorId: actor.id,
        },
      });

      if (plan.kind === 'AWARD' && player.invitedById) {
        await tx.pointEntry.create({
          data: {
            seasonId: plan.season.id,
            weekId: plan.weekId,
            playerId: player.invitedById,
            bucket: 'RESERVE',
            kind: 'RESERVE_SHARE',
            category: input.category,
            amount: reserveShare(recipient.amount),
            comment: `30% от начисления ${recipient.nickname}`,
            batchId,
            sourceId: entry.id,
            actorId: actor.id,
          },
        });
      }
    }
  });

  await audit({
    actor,
    action: 'points.award',
    target: batchId,
    meta: { players: plan.recipients.length, amount: input.amount, category: input.category },
  });

  return { batchId, count: plan.recipients.length };
}

export async function revertEntry(actor: User | null, entryId: string, reason: string) {
  assertAdmin(actor);
  const season = await openSeason();
  const text = reason.trim();
  if (text.length < 3) throw badRequest('comment_required', 'Напиши причину отмены');

  const entry = await prisma.pointEntry.findUnique({
    where: { id: entryId },
    include: { revertedBy: true, shares: { include: { revertedBy: true } } },
  });
  if (!entry || entry.seasonId !== season.id) throw notFound('Начисление не найдено в текущем сезоне');
  if (entry.kind !== 'AWARD' && entry.kind !== 'ADJUSTMENT') {
    throw badRequest('not_revertable', 'Отменить можно только начисление или корректировку');
  }
  if (entry.revertedBy) throw badRequest('already_reverted', 'Уже отменено');

  const batchId = randomUUID();
  const targets = [entry, ...entry.shares.filter((share) => !share.revertedBy)];

  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, season.id);
    for (const target of targets) {
      await tx.pointEntry.create({
        data: {
          seasonId: target.seasonId,
          weekId: target.weekId,
          playerId: target.playerId,
          bucket: target.bucket,
          kind: 'REVERSAL',
          category: target.category,
          presetId: target.presetId,
          amount: -target.amount,
          comment: text,
          postId: target.postId,
          batchId,
          revertsId: target.id,
          actorId: actor.id,
        },
      });
    }
  });

  await audit({ actor, action: 'points.revert', target: entry.id, meta: { reason: text } });
  return { batchId };
}

export async function withdrawReserve(actor: User | null, userId: string, amount: number) {
  assertAdmin(actor);
  const season = await openSeason();
  const week = await currentWeek(season);
  const player = await prisma.seasonPlayer.findUnique({
    where: { seasonId_userId: { seasonId: season.id, userId } },
  });
  if (!player) throw badRequest('empty_reserve', 'У игрока нет резерва');

  const batchId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, season.id);
    const reserve = await sum(tx, player.id, 'RESERVE');
    if (!isValidWithdraw(amount, reserve)) {
      throw badRequest(
        'bad_withdraw',
        `Вывести можно сумму, кратную 5, от 10 и не больше резерва (${formatPoints(reserve)})`,
      );
    }
    const base = {
      seasonId: season.id,
      weekId: week.id,
      playerId: player.id,
      kind: 'RESERVE_WITHDRAW' as const,
      category: 'REFERRAL' as const,
      comment: 'Вывод из резерва',
      batchId,
      actorId: actor.id,
    };
    await tx.pointEntry.create({ data: { ...base, bucket: 'RESERVE', amount: -amount } });
    await tx.pointEntry.create({ data: { ...base, bucket: 'MAIN', amount } });
  });

  await audit({ actor, action: 'points.withdraw', target: userId, meta: { amount } });
  return { batchId };
}

export async function setReferral(actor: User | null, userId: string, inviterUserId: string | null) {
  assertAdmin(actor);
  const season = await openSeason();

  const user = await prisma.user.findFirst({ where: { id: userId, type: 'MC' } });
  if (!user) throw notFound('Игрок не найден');

  const player = await prisma.seasonPlayer.upsert({
    where: { seasonId_userId: { seasonId: season.id, userId } },
    create: { seasonId: season.id, userId },
    update: {},
    include: { _count: { select: { invited: true } } },
  });

  if (!inviterUserId) {
    await prisma.seasonPlayer.update({ where: { id: player.id }, data: { invitedById: null } });
    await audit({ actor, action: 'points.referral', target: userId, meta: { inviter: null } });
    return;
  }

  if (inviterUserId === userId) throw badRequest('self_invite', 'Сам себя пригласить нельзя');
  if (player._count.invited > 0) {
    throw badRequest('inviter_cannot_be_invited', 'Этот игрок уже кого-то пригласил, значит сам приглашённым быть не может');
  }

  const inviterUser = await prisma.user.findFirst({ where: { id: inviterUserId, type: 'MC' } });
  if (!inviterUser) throw notFound('Пригласивший не найден');

  const inviter = await prisma.seasonPlayer.upsert({
    where: { seasonId_userId: { seasonId: season.id, userId: inviterUserId } },
    create: { seasonId: season.id, userId: inviterUserId },
    update: {},
  });
  if (inviter.invitedById) {
    throw badRequest('invited_cannot_invite', 'Приглашённые не могут приглашать');
  }

  await prisma.seasonPlayer.update({ where: { id: player.id }, data: { invitedById: inviter.id } });
  await audit({ actor, action: 'points.referral', target: userId, meta: { inviter: inviterUserId } });
}

export async function closeWeek(actor: User | null, weekId: string) {
  assertAdmin(actor);
  const season = await openSeason();
  const week = await currentWeek(season);
  if (week.id !== weekId) throw badRequest('not_current_week', 'Закрыть можно только текущую неделю');

  const now = new Date();
  await prisma.pointWeek.update({
    where: { id: week.id },
    data: { closedAt: now, endsAt: now, closedById: actor.id },
  });
  await audit({ actor, action: 'points.week.close', target: week.id, meta: { number: week.number } });
  return currentWeek(season);
}

export async function closeSeason(actor: User | null, seasonId: string) {
  assertSuperadmin(actor);
  const season = await openSeason();
  if (season.id !== seasonId) throw badRequest('not_current_season', 'Закрыть можно только текущий сезон');

  const week = await currentWeek(season);
  const batchId = randomUUID();
  const now = new Date();
  let settled = 0;

  await prisma.$transaction(async (tx) => {
    await lockSeason(tx, season.id);
    const reserves = await tx.pointEntry.groupBy({
      by: ['playerId'],
      where: { seasonId: season.id, bucket: 'RESERVE' },
      _sum: { amount: true },
    });

    for (const row of reserves) {
      const amount = row._sum.amount ?? 0;
      if (amount === 0) continue;
      const base = {
        seasonId: season.id,
        weekId: week.id,
        playerId: row.playerId,
        kind: 'SEASON_SETTLEMENT' as const,
        category: 'REFERRAL' as const,
        comment: 'Зачёт резерва при закрытии сезона',
        batchId,
        actorId: actor.id,
      };
      await tx.pointEntry.create({ data: { ...base, bucket: 'RESERVE', amount: -amount } });
      await tx.pointEntry.create({ data: { ...base, bucket: 'MAIN', amount } });
      settled += 1;
    }

    await tx.pointWeek.update({
      where: { id: week.id },
      data: { closedAt: now, endsAt: now, closedById: actor.id },
    });
    await tx.season.update({ where: { id: season.id }, data: { closedAt: now, closedById: actor.id } });
  });

  await audit({ actor, action: 'points.season.close', target: season.id, meta: { settled } });
  return { settled };
}

export async function startSeason(actor: User | null, title: string) {
  assertSuperadmin(actor);
  const latest = await currentSeason();
  if (!latest.closedAt) throw badRequest('season_open', 'Сначала закрой текущий сезон');

  const name = title.trim();
  if (name.length < 2) throw badRequest('bad_title', 'Название сезона слишком короткое');

  const now = new Date();
  const season = await prisma.season.create({
    data: { number: latest.number + 1, title: name, startsAt: now },
  });
  await prisma.pointWeek.create({
    data: {
      seasonId: season.id,
      number: 1,
      startsAt: now,
      endsAt: new Date(weekStartFor(now).getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await audit({ actor, action: 'points.season.start', target: season.id, meta: { title: name } });
  return season;
}
