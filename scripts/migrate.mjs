import { spawnSync } from "node:child_process";

// Migrations run DDL, which a Neon/pgbouncer pool cannot execute.
// prisma.config.ts already points `datasource.url` at the direct/unpooled URL
// for any provider. Kept dependency-free (no TS import) so it runs on any Node.
//
// No database configured -> skip instead of failing the build, so a fresh
// deploy succeeds and the UI is reachable before a DB is attached. Once a URL
// is present, a failed migration still aborts the build (schema errors matter).
const candidates = [
  process.env.DIRECT_URL,
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
];
if (!candidates.some(Boolean)) {
  console.warn(
    "⚠️  No database URL found — skipping migrations. Set DATABASE_URL (Neon) or "
      + "connect Vercel Postgres (POSTGRES_PRISMA_URL) to enable the database. "
      + "The app will build, but data-backed pages will error until then.",
  );
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
