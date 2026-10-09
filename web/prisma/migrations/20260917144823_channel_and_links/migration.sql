-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tgChannel" TEXT;

-- CreateTable
CREATE TABLE "TelegramChannelCache" (
    "channel" TEXT NOT NULL,
    "posts" JSONB NOT NULL,
    "title" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramChannelCache_pkey" PRIMARY KEY ("channel")
);

-- CreateIndex
CREATE INDEX "TelegramChannelCache_fetchedAt_idx" ON "TelegramChannelCache"("fetchedAt");
