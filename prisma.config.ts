import "dotenv/config";
import { defineConfig } from "prisma/config";
import { directDatabaseUrl } from "./src/lib/db-url";

// Prisma 7 no longer auto-loads .env or reads the datasource URL from the
// schema; both now live here. `directDatabaseUrl()` accepts any provider's
// direct/unpooled variable (Neon DIRECT_URL, Vercel Postgres
// DATABASE_URL_UNPOOLED, ...) and returns undefined when nothing is set, so
// `prisma generate` still works at build time without database credentials.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directDatabaseUrl(),
  },
});
