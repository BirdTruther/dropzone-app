-- Add notification preference columns to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "notifyPushNewDrop"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyPushReaction"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyPushComment"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyPushMention"   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyInAppNewDrop"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyInAppReaction" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyInAppComment"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyInAppMention"  BOOLEAN NOT NULL DEFAULT true;

-- Create Notification table
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"          TEXT         NOT NULL,
  "type"        TEXT         NOT NULL,
  "message"     TEXT         NOT NULL,
  "link"        TEXT,
  "actorName"   TEXT,
  "actorAvatar" TEXT,
  "read"        BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"      TEXT         NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
