import { spawnSync } from "node:child_process";

// Migrations run DDL, which a Neon/pgbouncer pool cannot execute.
// prisma.config.ts already points `datasource.url` at the direct/unpooled URL
// for any provider, so here we only need to fail loudly when no database is
// configured at all. Kept dependency-free (no TS import) so it runs on any Node.
const candidates = [
  process.env.DIRECT_URL,
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
];
if (!candidates.some(Boolean)) {
  console.error(
    "No database URL found. Set DATABASE_URL (Neon pooled) or DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING (Vercel Postgres).",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
