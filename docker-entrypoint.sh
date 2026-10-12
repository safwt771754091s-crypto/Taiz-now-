#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
node scripts/migrate.mjs

if [ "$SEED_ON_BOOT" = "true" ]; then
  echo "[entrypoint] seeding base data (idempotent)..."
  npx tsx prisma/seed.ts || echo "[entrypoint] seed skipped/failed (continuing)"
fi

echo "[entrypoint] starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
node server.js &
APP_PID=$!

# Always-on hosts have no Vercel Cron, so drive the agent tick in-process.
if [ -n "$CRON_SECRET" ]; then
  echo "[entrypoint] starting internal cron loop (every ${CRON_INTERVAL:-300}s)"
  (
    while true; do
      sleep "${CRON_INTERVAL:-300}"
      curl -fsS -m 120 -H "Authorization: Bearer ${CRON_SECRET}" \
        "http://127.0.0.1:${PORT:-3000}/api/cron/tick" >/dev/null 2>&1 || true
    done
  ) &
fi

wait "$APP_PID"
