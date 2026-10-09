-- CreateEnum
CREATE TYPE "PointCategory" AS ENUM ('EVENT', 'SOCIAL', 'COMMUNITY', 'CONTENT', 'VIEWS', 'REFERRAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PointBucket" AS ENUM ('MAIN', 'RESERVE');

-- CreateEnum
CREATE TYPE "PointKind" AS ENUM ('AWARD', 'ADJUSTMENT', 'REVERSAL', 'RESERVE_SHARE', 'RESERVE_WITHDRAW', 'SEASON_SETTLEMENT');

-- CreateEnum
CREATE TYPE "SeasonPlayerStatus" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointWeek" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "archiveWeekId" TEXT,

    CONSTRAINT "PointWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonPlayer" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT,
    "status" "SeasonPlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointPreset" (
    "id" TEXT NOT NULL,
    "category" "PointCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER,
    "oncePerSeason" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointEntry" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "bucket" "PointBucket" NOT NULL,
    "kind" "PointKind" NOT NULL,
    "category" "PointCategory",
    "presetId" TEXT,
    "amount" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "proofUrl" TEXT,
    "postId" TEXT,
    "batchId" TEXT NOT NULL,
    "sourceId" TEXT,
    "revertsId" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE INDEX "PointWeek_seasonId_startsAt_idx" ON "PointWeek"("seasonId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointWeek_seasonId_number_key" ON "PointWeek"("seasonId", "number");

-- CreateIndex
CREATE INDEX "SeasonPlayer_invitedById_idx" ON "SeasonPlayer"("invitedById");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPlayer_seasonId_userId_key" ON "SeasonPlayer"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "PointPreset_category_order_idx" ON "PointPreset"("category", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PointEntry_revertsId_key" ON "PointEntry"("revertsId");

-- CreateIndex
CREATE INDEX "PointEntry_seasonId_weekId_idx" ON "PointEntry"("seasonId", "weekId");

-- CreateIndex
CREATE INDEX "PointEntry_playerId_createdAt_idx" ON "PointEntry"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "PointEntry_actorId_idx" ON "PointEntry"("actorId");

-- CreateIndex
CREATE INDEX "PointEntry_presetId_idx" ON "PointEntry"("presetId");

-- CreateIndex
CREATE INDEX "PointEntry_batchId_idx" ON "PointEntry"("batchId");

-- CreateIndex
CREATE INDEX "PointEntry_sourceId_idx" ON "PointEntry"("sourceId");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointWeek" ADD CONSTRAINT "PointWeek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointWeek" ADD CONSTRAINT "PointWeek_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointWeek" ADD CONSTRAINT "PointWeek_archiveWeekId_fkey" FOREIGN KEY ("archiveWeekId") REFERENCES "ArchiveWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPlayer" ADD CONSTRAINT "SeasonPlayer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPlayer" ADD CONSTRAINT "SeasonPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPlayer" ADD CONSTRAINT "SeasonPlayer_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "SeasonPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "PointWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "SeasonPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "PointPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PointEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_revertsId_fkey" FOREIGN KEY ("revertsId") REFERENCES "PointEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
