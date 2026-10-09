-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('MC', 'TG');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "LoginCodeStatus" AS ENUM ('PENDING', 'CONFIRMED', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('LOGIN', 'LINK');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('PENDING', 'CONFIRMED', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PostTag" AS ENUM ('STREAM', 'OFFSTREAM');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ArchiveItemKind" AS ENUM ('BUILD', 'ART', 'VIDEO', 'POST', 'LIFE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "type" "UserType" NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "mcUuid" TEXT,
    "mcNickname" TEXT,
    "mcNicknameLower" TEXT,
    "tgId" BIGINT,
    "tgUsername" TEXT,
    "tgFirstName" TEXT,
    "tgPhotoUrl" TEXT,
    "cardFile" TEXT,
    "wikiText" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "firstLoginAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skin" (
    "userId" TEXT NOT NULL,
    "texturesValue" TEXT,
    "skinUrl" TEXT,
    "headPng" BYTEA NOT NULL,
    "isSlim" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skin_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "browserToken" TEXT NOT NULL,
    "status" "LoginCodeStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TgLoginToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'PENDING',
    "browserToken" TEXT NOT NULL,
    "targetUserId" TEXT,
    "resultUserId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "TgLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedNonce" (
    "nonce" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "tag" "PostTag" NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "upCount" INTEGER NOT NULL DEFAULT 0,
    "downCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "posterPath" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCache" (
    "tgId" BIGINT NOT NULL,
    "subscribed" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCache_pkey" PRIMARY KEY ("tgId")
);

-- CreateTable
CREATE TABLE "ArchiveWeek" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "coverPath" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveItem" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "kind" "ArchiveItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "path" TEXT,
    "url" TEXT,
    "authorId" TEXT,
    "postId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Общее',
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "WikiArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "description" TEXT,
    "authorId" TEXT,
    "weekId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "cardFile" TEXT,
    "links" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mcUuid_key" ON "User"("mcUuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_mcNicknameLower_key" ON "User"("mcNicknameLower");

-- CreateIndex
CREATE UNIQUE INDEX "User_tgId_key" ON "User"("tgId");

-- CreateIndex
CREATE INDEX "User_type_hidden_idx" ON "User"("type", "hidden");

-- CreateIndex
CREATE INDEX "User_firstLoginAt_idx" ON "User"("firstLoginAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginCode_code_key" ON "LoginCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LoginCode_browserToken_key" ON "LoginCode"("browserToken");

-- CreateIndex
CREATE INDEX "LoginCode_expiresAt_idx" ON "LoginCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TgLoginToken_token_key" ON "TgLoginToken"("token");

-- CreateIndex
CREATE INDEX "TgLoginToken_expiresAt_idx" ON "TgLoginToken"("expiresAt");

-- CreateIndex
CREATE INDEX "TgLoginToken_browserToken_idx" ON "TgLoginToken"("browserToken");

-- CreateIndex
CREATE INDEX "UsedNonce_createdAt_idx" ON "UsedNonce"("createdAt");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "Post_deletedAt_createdAt_idx" ON "Post"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Post_tag_createdAt_idx" ON "Post"("tag", "createdAt");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_score_idx" ON "Post"("score");

-- CreateIndex
CREATE INDEX "PostAttachment_postId_order_idx" ON "PostAttachment"("postId", "order");

-- CreateIndex
CREATE INDEX "Vote_userId_idx" ON "Vote"("userId");

-- CreateIndex
CREATE INDEX "Vote_createdAt_idx" ON "Vote"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_postId_userId_key" ON "Vote"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveWeek_number_key" ON "ArchiveWeek"("number");

-- CreateIndex
CREATE INDEX "ArchiveWeek_number_idx" ON "ArchiveWeek"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveItem_postId_key" ON "ArchiveItem"("postId");

-- CreateIndex
CREATE INDEX "ArchiveItem_weekId_order_idx" ON "ArchiveItem"("weekId", "order");

-- CreateIndex
CREATE INDEX "ArchiveItem_kind_idx" ON "ArchiveItem"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "WikiArticle_slug_key" ON "WikiArticle"("slug");

-- CreateIndex
CREATE INDEX "WikiArticle_category_idx" ON "WikiArticle"("category");

-- CreateIndex
CREATE INDEX "MediaItem_publishedAt_idx" ON "MediaItem"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_nickname_key" ON "TeamMember"("nickname");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skin" ADD CONSTRAINT "Skin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAttachment" ADD CONSTRAINT "PostAttachment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveItem" ADD CONSTRAINT "ArchiveItem_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "ArchiveWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveItem" ADD CONSTRAINT "ArchiveItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveItem" ADD CONSTRAINT "ArchiveItem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiArticle" ADD CONSTRAINT "WikiArticle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "ArchiveWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

