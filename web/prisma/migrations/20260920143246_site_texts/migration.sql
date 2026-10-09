-- CreateTable
CREATE TABLE "SiteText" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SiteText_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "SiteText" ADD CONSTRAINT "SiteText_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
