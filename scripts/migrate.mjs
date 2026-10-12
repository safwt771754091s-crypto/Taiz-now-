import { spawnSync } from "node:child_process";

// Neon/pgbouncer pools cannot run the DDL that `prisma migrate` needs.
// DIRECT_URL points at the direct (unpooled) endpoint; when it is absent we
// fall back to DATABASE_URL so a single-URL setup still works.
process.env.DIRECT_URL ||= process.env.DATABASE_URL || "";

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(result.status ?? 1);
