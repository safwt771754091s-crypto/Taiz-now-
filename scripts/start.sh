#!/usr/bin/env bash
# Start the Taiz Now production server and the self-healing watchdog.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-12000}"
LOG_DIR="$ROOT/.run"
mkdir -p "$LOG_DIR"

# Ensure a production build exists.
if [ ! -f .next/BUILD_ID ]; then
  echo "[start] No production build found — building..."
  npm run build
fi

# Ensure PostgreSQL is up.
if ! pg_isready -q -h 127.0.0.1 -p 5432 2>/dev/null; then
  echo "[start] Starting PostgreSQL..."
  sudo pg_ctlcluster 17 main start 2>/dev/null || sudo service postgresql start 2>/dev/null || true
  for _ in $(seq 1 20); do pg_isready -q -h 127.0.0.1 -p 5432 && break; sleep 1; done
fi

# Start the Next.js server if it is not already listening.
if ! (ss -ltn 2>/dev/null | grep -q ":${PORT} "); then
  echo "[start] Starting Next.js on port ${PORT}..."
  PORT="$PORT" nohup npx next start -p "$PORT" > "$LOG_DIR/app.log" 2>&1 &
  echo $! > "$LOG_DIR/app.pid"
fi

# Start the watchdog if not already running.
if [ ! -f "$LOG_DIR/watchdog.pid" ] || ! kill -0 "$(cat "$LOG_DIR/watchdog.pid" 2>/dev/null)" 2>/dev/null; then
  echo "[start] Starting watchdog..."
  nohup bash "$ROOT/scripts/watchdog.sh" > "$LOG_DIR/watchdog.log" 2>&1 &
  echo $! > "$LOG_DIR/watchdog.pid"
fi

# Start the AI agent autopilot loop if not already running.
if [ ! -f "$LOG_DIR/autopilot.pid" ] || ! kill -0 "$(cat "$LOG_DIR/autopilot.pid" 2>/dev/null)" 2>/dev/null; then
  echo "[start] Starting autopilot loop..."
  nohup bash "$ROOT/scripts/autopilot_loop.sh" > "$LOG_DIR/autopilot_loop.log" 2>&1 &
  echo $! > "$LOG_DIR/autopilot.pid"
fi

echo "[start] Done. App: http://localhost:${PORT}"
