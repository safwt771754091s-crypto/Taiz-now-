-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('EMAIL', 'WEBHOOK', 'INBOX');

-- CreateEnum
CREATE TYPE "AlertDelivery" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecoveryChannelKind" AS ENUM ('BACKUP_EMAIL', 'PHONE', 'TOTP');

-- CreateTable
CREATE TABLE "SecurityAlert" (
    "id" TEXT NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'INFO',
    "status" "AlertDelivery" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "securityEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryChannel" (
    "id" TEXT NOT NULL,
    "kind" "RecoveryChannelKind" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "userId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityAlert_status_idx" ON "SecurityAlert"("status");

-- CreateIndex
CREATE INDEX "SecurityAlert_createdAt_idx" ON "SecurityAlert"("createdAt");

-- CreateIndex
CREATE INDEX "RecoveryChannel_userId_idx" ON "RecoveryChannel"("userId");

-- CreateIndex
CREATE INDEX "LoginEvent_email_createdAt_idx" ON "LoginEvent"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_fingerprint_idx" ON "LoginEvent"("fingerprint");

-- AddForeignKey
ALTER TABLE "RecoveryChannel" ADD CONSTRAINT "RecoveryChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
