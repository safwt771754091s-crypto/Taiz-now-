#!/usr/bin/env bash
# Background autopilot: runs the AI agents on a fixed interval so the platform
# keeps triaging, verifying, writing and publishing without a human logged in.
# Safe to leave running; it only touches stored data.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INTERVAL="${AUTOPILOT_INTERVAL:-180}"
LOG_DIR="$ROOT/.run"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/autopilot.log"

echo "[autopilot_loop] starting (interval ${INTERVAL}s) at $(date -Is)" >> "$LOG"

while true; do
  npx tsx scripts/autopilot.ts >> "$LOG" 2>&1 || echo "[autopilot_loop] tick failed at $(date -Is)" >> "$LOG"
  sleep "$INTERVAL"
done
