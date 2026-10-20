import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Vercel runs the build command from the project's "Root Directory", which on
// some projects is set to a subfolder. Rather than trust that, we locate
// prisma/schema.prisma by walking up from the current directory and run the
// whole build from the repository root. This makes the build work no matter
// where Vercel starts it.
const SCHEMA = join("prisma", "schema.prisma");

function findRepoRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, SCHEMA))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const root = findRepoRoot(process.cwd());
if (!root) {
  console.error(`[build] Could not find ${SCHEMA} from ${process.cwd()}`);
  console.error(`[build] Contents: ${readdirSync(process.cwd()).join(", ")}`);
  process.exit(1);
}
console.log(`[build] Repository root: ${root}`);

function run(label, command, args) {
  console.log(`[build] ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) {
    console.error(`[build] ${label} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const bin = (name) => {
  const local = join(root, "node_modules", ".bin", name);
  return existsSync(local) ? local : name;
};

run("prisma generate", bin("prisma"), ["generate", "--schema", SCHEMA]);
run("database migrations", process.execPath, ["scripts/migrate.mjs"]);
run("next build", bin("next"), ["build"]);
