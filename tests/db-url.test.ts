import { afterEach, describe, expect, it } from "vitest";
import { directDatabaseUrl, pooledDatabaseUrl } from "@/lib/db-url";

const KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
];

const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function clearAll() {
  for (const key of KEYS) delete process.env[key];
}

describe("db-url resolver", () => {
  it("prefers DATABASE_URL when present", () => {
    clearAll();
    process.env.DATABASE_URL = "postgres://a";
    expect(pooledDatabaseUrl()).toBe("postgres://a");
    expect(directDatabaseUrl()).toBe("postgres://a");
  });

  it("falls back to Vercel Postgres variable names", () => {
    clearAll();
    process.env.POSTGRES_PRISMA_URL = "postgres://pooled";
    process.env.POSTGRES_URL_NON_POOLING = "postgres://direct";
    expect(pooledDatabaseUrl()).toBe("postgres://pooled");
    expect(directDatabaseUrl()).toBe("postgres://direct");
  });

  it("uses the direct URL for migrations when both are set", () => {
    clearAll();
    process.env.DATABASE_URL = "postgres://pooled";
    process.env.DIRECT_URL = "postgres://direct";
    expect(pooledDatabaseUrl()).toBe("postgres://pooled");
    expect(directDatabaseUrl()).toBe("postgres://direct");
  });

  it("returns undefined when nothing is configured", () => {
    clearAll();
    expect(pooledDatabaseUrl()).toBeUndefined();
    expect(directDatabaseUrl()).toBeUndefined();
  });
});
