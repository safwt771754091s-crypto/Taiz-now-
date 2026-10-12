// Resolves the Postgres connection string regardless of provider. Vercel
// Postgres and the Neon integration inject their own variable names, so we
// accept any of the common ones instead of requiring a hand-copied DATABASE_URL.
// Kept free of imports so both the Next.js app and prisma.config.ts can use it.

const POOLED_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL", // Vercel Postgres (pooled, pgbouncer)
  "POSTGRES_URL", // Vercel Postgres (pooled)
  "NEON_DATABASE_URL",
];

const DIRECT_CANDIDATES = [
  "DIRECT_URL",
  "DATABASE_URL_UNPOOLED", // Vercel Postgres (direct)
  "POSTGRES_URL_NON_POOLING", // Vercel Postgres (direct)
];

function firstSet(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

/** Pooled URL for runtime queries (through pgbouncer on serverless). */
export function pooledDatabaseUrl(): string | undefined {
  return firstSet(POOLED_CANDIDATES);
}

/** Direct URL for migrations (DDL cannot run through a pooler). */
export function directDatabaseUrl(): string | undefined {
  return firstSet(DIRECT_CANDIDATES) ?? pooledDatabaseUrl();
}
