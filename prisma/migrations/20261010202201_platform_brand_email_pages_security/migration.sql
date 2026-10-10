-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('INFO', 'SUPPORT', 'NOREPLY', 'SECURITY');

-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('LANDING', 'SECTION', 'PLATFORM', 'CONTACT', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityEventKind" AS ENUM ('CONFIG_DRIFT', 'BRAND_CHANGE', 'EMAIL_CHANGE', 'PAGE_CHANGE', 'ROLE_CHANGE', 'PASSWORD_CHANGE', 'LOGIN_FAILED', 'NEW_DEVICE', 'CONNECTION_CHANGE', 'INTEGRITY_OK', 'RECOVERY');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "PlatformBrand" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "name" TEXT NOT NULL DEFAULT 'تعز الآن',
    "nameEn" TEXT NOT NULL DEFAULT 'Taiz Now',
    "tagline" TEXT NOT NULL DEFAULT 'منصة التحقق الذكي',
    "slogan" TEXT NOT NULL DEFAULT 'لا ننشر ما يُقال... بل نتحقق مما حدث.',
    "primary" TEXT NOT NULL DEFAULT '#2dd4bf',
    "accent" TEXT NOT NULL DEFAULT '#38bdf8',
    "website" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformEmailAccount" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL DEFAULT 'INFO',
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "linkedVia" TEXT NOT NULL DEFAULT 'google',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "usedForLogin" BOOLEAN NOT NULL DEFAULT false,
    "usedForRecovery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformEmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "kind" "PageKind" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "systemRoute" BOOLEAN NOT NULL DEFAULT false,
    "agentBuilt" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "navOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "health" TEXT NOT NULL DEFAULT 'ok',
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "kind" "SecurityEventKind" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "detail" JSONB,
    "actorId" TEXT,
    "subjectId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigSnapshot" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'platform',
    "hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "approvedBy" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformEmailAccount_address_key" ON "PlatformEmailAccount"("address");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedPage_slug_key" ON "ManagedPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedPage_route_key" ON "ManagedPage"("route");

-- CreateIndex
CREATE INDEX "ManagedPage_kind_idx" ON "ManagedPage"("kind");

-- CreateIndex
CREATE INDEX "SecurityEvent_kind_idx" ON "SecurityEvent"("kind");

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ConfigSnapshot_scope_createdAt_idx" ON "ConfigSnapshot"("scope", "createdAt");
