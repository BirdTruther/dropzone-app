-- Add uploadStatus to Post for background ffmpeg conversion tracking
ALTER TABLE "Post" ADD COLUMN "uploadStatus" TEXT;
