-- AlterTable: scheduled publishing metadata on SocialPost
ALTER TABLE "SocialPost" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "SocialPost" ADD COLUMN "error" TEXT;

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status", "scheduledAt");
