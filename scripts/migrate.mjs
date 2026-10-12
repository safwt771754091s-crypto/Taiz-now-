import { spawnSync } from "node:child_process";

// Migrations run DDL, which a Neon/pgbouncer pool cannot execute. DIRECT_URL is
// the direct (unpooled) endpoint; the app itself keeps using the pooled
// DATABASE_URL at runtime. When DIRECT_URL is unset we use DATABASE_URL as-is.
const env = { ...process.env };
if (env.DIRECT_URL) env.DATABASE_URL = env.DIRECT_URL;

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
