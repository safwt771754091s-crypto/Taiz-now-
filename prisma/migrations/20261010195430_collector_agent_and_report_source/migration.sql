-- AlterEnum
ALTER TYPE "AgentKind" ADD VALUE 'COLLECTOR';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "origin" TEXT,
ADD COLUMN     "sourceUrl" TEXT;
