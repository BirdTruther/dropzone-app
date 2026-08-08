-- AlterTable
ALTER TABLE "Group" ADD COLUMN "joinCode" TEXT;

-- Backfill every existing group with a short, human-friendly join code
UPDATE "Group" SET "joinCode" = upper(substring(md5(id::text || random()::text) from 1 for 8));

-- CreateIndex
CREATE UNIQUE INDEX "Group_joinCode_key" ON "Group"("joinCode");
