/**
 * Run one autopilot tick from the command line. The background loop
 * (scripts/autopilot_loop.sh) calls this on an interval so the platform keeps
 * working without a human logged in.
 */
import { runAutopilot, ensureAgents } from "../src/lib/agents/runtime";
import { ensureConnections } from "../src/lib/social/connect";
import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    await ensureAgents();
    await ensureConnections();
    const results = await runAutopilot();
    for (const r of results) {
      console.log(`[autopilot] ${r.agent} — ${r.ok ? "ok" : "error"} — ${r.summary}`);
    }
    const okCount = results.filter((r) => r.ok).length;
    console.log(`[autopilot] done: ${okCount}/${results.length} agents ok at ${new Date().toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[autopilot] failed:", err);
  process.exit(1);
});
