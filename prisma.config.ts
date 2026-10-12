import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env or reads the datasource URL from the
// schema; both now live here. Migrate uses DATABASE_URL (falls back to
// DIRECT_URL when a pooler requires the direct connection).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
