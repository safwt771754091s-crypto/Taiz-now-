import { spawnSync } from "node:child_process";

// Migrations run DDL. We try every configured connection URL in order, direct
// first, then the pooled one. This matters for Supabase: the direct host
// (db.<ref>.supabase.co) is IPv6-only and unreachable from Vercel's IPv4 build
// machines, while the pooler host is IPv4 — so falling back to the pooler URL
// lets migrations succeed there.
//
// Migrations must never break a deployment on their own:
//  - No database URL at all -> skip (the UI still builds and is reachable).
//  - Every URL fails         -> warn and continue, so the site still deploys.
// Set MIGRATE_STRICT=1 to fail the build instead when migrations cannot run.
const timeoutMs = Number(process.env.MIGRATE_TIMEOUT_MS || 60_000);
const candidates = [
  process.env.DIRECT_URL,
  process.env.DATABASE_URL_UNPOOLED,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
].filter(Boolean);

// De-duplicate while preserving order.
const urls = [...new Set(candidates)];

if (urls.length === 0) {
  console.warn(
    "⚠️  No database URL found — skipping migrations. Attach a database "
      + "(Vercel Postgres, or set DATABASE_URL/DIRECT_URL to a Supabase session "
      + "pooler) so data-backed pages work.",
  );
  process.exit(0);
}

let lastError = "no attempt made";
for (const url of urls) {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    // prisma.config.ts resolves the migration URL via directDatabaseUrl(),
    // which prefers DIRECT_URL. Override both so this attempt's URL is used.
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    timeout: timeoutMs,
  });
  if (result.status === 0) process.exit(0);
  lastError = result.error
    ? result.error.code || result.error.message
    : `exit ${result.status}`;
}

console.warn(
  `⚠️  Migrations did not complete (${lastError}). The deployment continues so the `
    + "site stays reachable.\n"
    + "    For Supabase, use the *Session pooler* string for DATABASE_URL and "
    + "DIRECT_URL (host ends in pooler.supabase.com, port 5432, IPv4) — the direct "
    + "db.<ref>.supabase.co host is IPv6-only and cannot be reached from Vercel.",
);

process.exit(process.env.MIGRATE_STRICT === "1" ? 1 : 0);
