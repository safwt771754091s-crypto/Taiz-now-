-- Owner-managed sections (categories) for the whole platform.
-- Added 2026-10-12 for the owner control panel.

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "navOrder" INTEGER NOT NULL DEFAULT 100,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Section_slug_key" ON "Section"("slug");

-- CreateIndex
CREATE INDEX "Section_published_navOrder_idx" ON "Section"("published", "navOrder");

-- AlterTable: link content items to an owner-defined section.
ALTER TABLE "ContentItem" ADD COLUMN "sectionSlug" TEXT;

-- Seed the default sections (idempotent).
INSERT INTO "Section" ("id", "slug", "title", "titleEn", "description", "icon", "navOrder", "published", "system", "updatedAt") VALUES
  ('sec_news', 'news', 'الأخبار الموثقة', 'News', 'أخبار تم التحقق منها بالأدلة والمصادر.', '📰', 10, true, true, CURRENT_TIMESTAMP),
  ('sec_rumors', 'rumors', 'مرصد الشائعات', 'Rumor Watch', 'رصد الشائعات المتداولة وتقييم صحتها.', '🔎', 20, true, true, CURRENT_TIMESTAMP),
  ('sec_corrections', 'corrections', 'مركز التصحيحات', 'Corrections', 'تصحيحات شفافة لما نُشر سابقاً.', '✍️', 30, true, true, CURRENT_TIMESTAMP),
  ('sec_maps', 'maps', 'الخرائط والتحقق الجغرافي', 'Maps', 'تحقق جغرافي وخرائط تفاعلية للأحداث.', '🗺️', 40, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
